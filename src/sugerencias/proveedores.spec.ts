import { ProveedorFalso } from './proveedor-falso';
import {
  type EntradaSugerencia,
  ErrorProveedorSugerencia,
  ProveedorDesactivado,
  ProveedorSugerencia,
} from './proveedor-sugerencia';

const ENTRADA: EntradaSugerencia = {
  movimiento: {
    fecha: '2026-09-02',
    monto: '1160.00',
    moneda: 'MXN',
    descripcion: 'SPEI RECIBIDO',
    referencia: null,
  },
  candidatos: [
    {
      etiqueta: 'C1',
      serieFolio: 'A-1001',
      total: '1160.00',
      fecha: '2026-09-01',
      receptor: 'CLIENTE SA',
    },
  ],
};

describe('ProveedorDesactivado', () => {
  it('no está activo y se identifica como desactivado', () => {
    const proveedor = new ProveedorDesactivado();
    expect(proveedor).toBeInstanceOf(ProveedorSugerencia);
    expect(proveedor.activo).toBe(false);
    expect(proveedor.modelo).toBe('desactivado');
  });

  it('si alguien lo llama igual, falla con ErrorProveedorSugerencia', async () => {
    await expect(new ProveedorDesactivado().sugerir()).rejects.toBeInstanceOf(
      ErrorProveedorSugerencia,
    );
  });
});

describe('ProveedorFalso', () => {
  it('por omisión está activo y responde "ninguno"', async () => {
    const falso = new ProveedorFalso();
    expect(falso.activo).toBe(true);
    await expect(falso.sugerir(ENTRADA)).resolves.toEqual({
      decision: 'ninguno',
    });
  });

  it('guarda cada entrada recibida, en orden', async () => {
    const falso = new ProveedorFalso();
    await falso.sugerir(ENTRADA);
    await falso.sugerir({ ...ENTRADA, candidatos: [] });
    expect(falso.llamadas).toBe(2);
    expect(falso.recibidas[0]).toBe(ENTRADA);
    expect(falso.recibidas[1].candidatos).toEqual([]);
  });

  it('sigue el guion en orden y repite el último paso', async () => {
    const falso = new ProveedorFalso([
      {
        decision: 'sugerir',
        candidato: 'C1',
        confianza: 'alta',
        explicacion: 'x',
      },
      { decision: 'sin_respuesta' },
    ]);
    expect((await falso.sugerir(ENTRADA)).decision).toBe('sugerir');
    expect((await falso.sugerir(ENTRADA)).decision).toBe('sin_respuesta');
    expect((await falso.sugerir(ENTRADA)).decision).toBe('sin_respuesta');
  });

  it('un Error en el guion se lanza como rechazo', async () => {
    const falso = new ProveedorFalso(new ErrorProveedorSugerencia('caído'));
    await expect(falso.sugerir(ENTRADA)).rejects.toThrow('caído');
    expect(falso.llamadas).toBe(1);
  });

  it('una función del guion decide según la entrada, y si lanza, rechaza', async () => {
    const elige = new ProveedorFalso((e: EntradaSugerencia) => ({
      decision: 'sugerir',
      candidato: e.candidatos[0].etiqueta,
      confianza: 'media',
      explicacion: 'ok',
    }));
    await expect(elige.sugerir(ENTRADA)).resolves.toMatchObject({
      candidato: 'C1',
    });

    const truena = new ProveedorFalso(() => {
      throw new ErrorProveedorSugerencia('boom');
    });
    await expect(truena.sugerir(ENTRADA)).rejects.toThrow('boom');
  });

  it('permite fijar modelo y apagarlo', () => {
    const falso = new ProveedorFalso({}, { modelo: 'otro', activo: false });
    expect(falso.modelo).toBe('otro');
    expect(falso.activo).toBe(false);
  });
});
