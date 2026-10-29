import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { mensajeDeError } from '@/shared/api/mensajes';
import { clasificarErrorLectura, clasificarErrorSubida } from './errores';
import {
  TEXTO_MONEDA_NO_MXN,
  TEXTO_PDF_ILEGIBLE,
  TEXTO_PDF_SIN_TEXTO,
} from './textos';

const api = (status: number, mensajes: string[] = []) =>
  new ApiError(status, 'Error', mensajes);
const cancelacion = () => new DOMException('cancelado', 'AbortError');

const conCuerpo = (codigo: string, mensaje: string, extra: object = {}) =>
  new ApiError(400, codigo, [mensaje], {
    statusCode: 400,
    error: codigo,
    message: mensaje,
    ...extra,
  });
const NO_LEIDAS = [
  { linea: 18, texto: '07/SEP PAGO SERVICIO NO RECONOCIDO 1,25' },
  { linea: 31, texto: '12/SEP CARGO ILEGIBLE' },
];

describe('clasificarErrorSubida: rechazos del PDF (historia 3.3)', () => {
  it('saldos_no_cuadran: mensaje, saldos como cadenas y líneas', () => {
    expect(
      clasificarErrorSubida(
        conCuerpo('saldos_no_cuadran', 'No cuadran', {
          saldoEsperado: '11500.50',
          diferencia: '-250.00',
          lineasNoLeidas: NO_LEIDAS,
        }),
      ),
    ).toEqual({
      clase: 'pdf_saldos_no_cuadran',
      mensaje: 'No cuadran',
      saldoEsperado: '11500.50',
      diferencia: '-250.00',
      lineas: NO_LEIDAS,
    });
  });

  it('lineas_no_leidas: mensaje y líneas', () => {
    expect(
      clasificarErrorSubida(
        conCuerpo('lineas_no_leidas', 'Hay líneas', {
          lineasNoLeidas: [NO_LEIDAS[0]],
        }),
      ),
    ).toEqual({
      clase: 'pdf_lineas_no_leidas',
      mensaje: 'Hay líneas',
      lineas: [NO_LEIDAS[0]],
    });
  });

  it('sin_movimientos: solo el mensaje', () => {
    expect(
      clasificarErrorSubida(conCuerpo('sin_movimientos', 'Sin movimientos')),
    ).toEqual({ clase: 'pdf_sin_movimientos', mensaje: 'Sin movimientos' });
  });

  it('saldos_no_cuadran: el saldo final del PDF llega como cadena', () => {
    expect(
      clasificarErrorSubida(
        conCuerpo('saldos_no_cuadran', 'No cuadran', {
          saldoFinal: '11250.50',
          saldoEsperado: '11000',
          diferencia: '250.5',
          lineasNoLeidas: [],
        }),
      ),
    ).toEqual({
      clase: 'pdf_saldos_no_cuadran',
      mensaje: 'No cuadran',
      saldoFinal: '11250.50',
      saldoEsperado: '11000',
      diferencia: '250.5',
      lineas: [],
    });
  });

  it('saldos_no_cuadran con cuerpo vacío o incompleto: su rechazo, sin los detalles que faltan', () => {
    expect(
      clasificarErrorSubida(new ApiError(400, 'saldos_no_cuadran', ['x'])),
    ).toEqual({ clase: 'pdf_saldos_no_cuadran', mensaje: 'x', lineas: [] });
    expect(
      clasificarErrorSubida(
        conCuerpo('saldos_no_cuadran', 'x', { saldoEsperado: 11500.5 }),
      ),
    ).toEqual({ clase: 'pdf_saldos_no_cuadran', mensaje: 'x', lineas: [] });
    expect(
      clasificarErrorSubida(
        conCuerpo('saldos_no_cuadran', 'x', { diferencia: '-1.00' }),
      ),
    ).toEqual({
      clase: 'pdf_saldos_no_cuadran',
      mensaje: 'x',
      diferencia: '-1.00',
      lineas: [],
    });
  });

  it('lineas_no_leidas con cuerpo vacío o incompleto: su rechazo, sin líneas', () => {
    const esperado = {
      clase: 'pdf_lineas_no_leidas',
      mensaje: 'x',
      lineas: [],
    };
    expect(
      clasificarErrorSubida(new ApiError(400, 'lineas_no_leidas', ['x'])),
    ).toEqual(esperado);
    expect(
      clasificarErrorSubida(
        conCuerpo('lineas_no_leidas', 'x', { lineasNoLeidas: 'no' }),
      ),
    ).toEqual(esperado);
  });

  it('sin_movimientos con cuerpo vacío: su rechazo', () => {
    expect(
      clasificarErrorSubida(new ApiError(400, 'sin_movimientos', ['x'])),
    ).toEqual({ clase: 'pdf_sin_movimientos', mensaje: 'x' });
  });

  it('un código desconocido sigue siendo un rechazo genérico', () => {
    expect(
      clasificarErrorSubida(new ApiError(400, 'otro_codigo', ['x'])),
    ).toEqual({ clase: 'rechazo', detalle: 'x' });
  });
});

describe('clasificarErrorSubida', () => {
  it('400 con motivo en texto: rechazo con el motivo exacto', () => {
    expect(
      clasificarErrorSubida(api(400, ['Solo se aceptan archivos .xml'])),
    ).toEqual({ clase: 'rechazo', detalle: 'Solo se aceptan archivos .xml' });
  });

  it('400 con varios mensajes: se unen con un espacio (M8)', () => {
    expect(
      clasificarErrorSubida(
        api(400, ['banco es muy largo', 'cuenta inválida']),
      ),
    ).toEqual({
      clase: 'rechazo',
      detalle: 'banco es muy largo cuenta inválida',
    });
  });

  it('400 sin motivo o con motivo vacío: detalle null', () => {
    expect(clasificarErrorSubida(api(400))).toEqual({
      clase: 'rechazo',
      detalle: null,
    });
    expect(clasificarErrorSubida(api(400, ['  ']))).toEqual({
      clase: 'rechazo',
      detalle: null,
    });
  });

  it('413 es demasiado_grande por el código, con cuerpo JSON o con HTML de proxy', () => {
    expect(clasificarErrorSubida(api(413, ['Payload too large']))).toEqual({
      clase: 'demasiado_grande',
    });
    // El HTML de un proxy llega como ApiError sin mensajes.
    expect(clasificarErrorSubida(api(413))).toEqual({
      clase: 'demasiado_grande',
    });
  });

  it('403 es sin_permiso', () => {
    expect(clasificarErrorSubida(api(403))).toEqual({ clase: 'sin_permiso' });
  });

  it('un fallo de red es conexion', () => {
    expect(clasificarErrorSubida(new NetworkError())).toEqual({
      clase: 'conexion',
    });
  });

  it('500, un fallo de contrato y cualquier otro código son otro', () => {
    expect(clasificarErrorSubida(api(500))).toEqual({ clase: 'otro' });
    expect(clasificarErrorSubida(new ContratoError())).toEqual({
      clase: 'otro',
    });
    expect(clasificarErrorSubida(api(409))).toEqual({ clase: 'otro' });
    expect(clasificarErrorSubida(new Error('raro'))).toEqual({ clase: 'otro' });
  });

  it('una cancelación y un 401 no muestran nada', () => {
    expect(clasificarErrorSubida(cancelacion())).toBeNull();
    expect(clasificarErrorSubida(api(401))).toBeNull();
  });
});

describe('clasificarErrorLectura', () => {
  it('403 es sin_permiso', () => {
    expect(clasificarErrorLectura(api(403))).toBe('sin_permiso');
  });

  it('401 y la cancelación no muestran nada', () => {
    expect(clasificarErrorLectura(api(401))).toBeNull();
    expect(clasificarErrorLectura(cancelacion())).toBeNull();
  });

  it('red, 5xx, contrato y el resto son conexion', () => {
    expect(clasificarErrorLectura(new NetworkError())).toBe('conexion');
    expect(clasificarErrorLectura(api(500))).toBe('conexion');
    expect(clasificarErrorLectura(new ContratoError())).toBe('conexion');
    expect(clasificarErrorLectura(api(404))).toBe('conexion');
    expect(clasificarErrorLectura(new Error('raro'))).toBe('conexion');
  });
});

describe('API-20.5: mensajeDeError no cambia', () => {
  it('un 400 fuera de la subida sigue siendo la copia fija, sin texto del servidor', () => {
    const mensaje = mensajeDeError(api(400, ['texto del servidor']));
    expect(mensaje).toEqual({
      titulo: 'No se pudo completar la solicitud.',
      tipo: 'otro',
    });
    expect(JSON.stringify(mensaje)).not.toContain('texto del servidor');
  });
});

describe('clasificarErrorSubida: estado de cuenta que no está en MXN', () => {
  const MENSAJE =
    'El estado de cuenta no está en MXN. Cuadra solo procesa estados de cuenta en pesos mexicanos.';

  it('un 400 con error moneda_no_mxn es su propia clase', () => {
    expect(
      clasificarErrorSubida(new ApiError(400, 'moneda_no_mxn', [MENSAJE])),
    ).toEqual({ clase: 'moneda_no_mxn' });
  });

  it('el texto sale de una constante del frontend, no del servidor', () => {
    expect(TEXTO_MONEDA_NO_MXN).toEqual({
      titulo: 'Archivo rechazado',
      detalle: MENSAJE,
    });
    const clase = clasificarErrorSubida(
      new ApiError(400, 'moneda_no_mxn', ['otro texto del servidor']),
    );
    expect(clase).toEqual({ clase: 'moneda_no_mxn' });
    expect(JSON.stringify(clase)).not.toContain('otro texto');
  });

  it('otros 400 (o el mismo código con otro estado) conservan su clase', () => {
    expect(clasificarErrorSubida(api(400, ['Falta el archivo']))).toEqual({
      clase: 'rechazo',
      detalle: 'Falta el archivo',
    });
    expect(
      clasificarErrorSubida(new ApiError(400, 'Bad Request', [MENSAJE])),
    ).toEqual({ clase: 'rechazo', detalle: MENSAJE });
    expect(
      clasificarErrorSubida(new ApiError(500, 'moneda_no_mxn', [MENSAJE])),
    ).toEqual({ clase: 'otro' });
  });
});

describe('clasificarErrorSubida: lectura de PDF (historia 3.2)', () => {
  it('un 400 con error pdf_sin_texto es su propia clase', () => {
    expect(
      clasificarErrorSubida(
        new ApiError(400, 'pdf_sin_texto', ['texto del servidor']),
      ),
    ).toEqual({ clase: 'pdf_sin_texto' });
  });

  it('un 400 con error pdf_ilegible es su propia clase', () => {
    expect(
      clasificarErrorSubida(
        new ApiError(400, 'pdf_ilegible', ['texto del servidor']),
      ),
    ).toEqual({ clase: 'pdf_ilegible' });
  });

  it('los textos son del frontend, no del servidor', () => {
    expect(TEXTO_PDF_SIN_TEXTO).toEqual({
      titulo: 'No se pudo leer el PDF',
      detalle:
        'El PDF no tiene texto seleccionable (parece una imagen escaneada). Descarga el PDF desde el portal del banco.',
    });
    expect(TEXTO_PDF_ILEGIBLE).toEqual({
      titulo: 'No se pudo leer el PDF',
      detalle: 'No reconocimos el formato del estado de cuenta BBVA.',
    });
  });

  it('el mismo código con otro estado no cambia de clase', () => {
    expect(
      clasificarErrorSubida(new ApiError(500, 'pdf_sin_texto', ['x'])),
    ).toEqual({ clase: 'otro' });
    expect(
      clasificarErrorSubida(new ApiError(403, 'pdf_ilegible', ['x'])),
    ).toEqual({ clase: 'sin_permiso' });
  });
});
