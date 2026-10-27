import { describe, expect, it } from 'vitest';
import {
  detalleCarga,
  itemCarga,
  LISTA_DE_VEINTE,
  PERFILES,
} from '@/test/fixturesCargas';
import {
  detalleFalla,
  listaFalla,
  listaRedDeFallo,
  perfilesFalla,
  subida413Html,
  subidaCfdiConMonedaNoSoportada,
  subidaEstadoCuentaMonedaNoMxn,
  subidaFalla,
  subidaFueraDeContrato,
  subidaRedDeFallo,
} from '@/test/handlersCargas';
import { almacenes } from '@/test/handlers';
import { crearCompuerta } from '@/test/compuerta';
import { servidor } from '@/test/servidor';
import {
  respuestaCarga,
  respuestaListaCargas,
  perfilesBancarios,
} from '@/shared/api/contratos';

const cargas = almacenes.cargas;

async function pedir(ruta: string, init?: RequestInit) {
  const respuesta = await fetch(`/api${ruta}`, init);
  const texto = await respuesta.text();
  let cuerpo: unknown = texto;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    // cuerpo no JSON (HTML de proxy): se devuelve el texto.
  }
  return { status: respuesta.status, cuerpo };
}

function formulario(
  archivos: Array<[string, string]>,
  campos: Record<string, string> = {},
) {
  const f = new FormData();
  for (const [campo, nombre] of archivos) {
    f.append(campo, new File(['contenido'], nombre));
  }
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

describe('manejadores de lectura de cargas', () => {
  it('GET /cargas sirve veinte filas que cumplen el contrato, la más nueva primero', async () => {
    const { status, cuerpo } = await pedir('/cargas');
    expect(status).toBe(200);
    const lista = respuestaListaCargas.parse(cuerpo);
    expect(lista.datos).toHaveLength(20);
    expect(lista.datos[0]?.id).toBe(LISTA_DE_VEINTE[0]?.id);
  });

  it('GET /cargas/:id sirve el detalle, 404 si no existe y 400 si no es uuid', async () => {
    const id = LISTA_DE_VEINTE[0]?.id ?? '';
    const ok = await pedir(`/cargas/${id}`);
    expect(ok.status).toBe(200);
    expect((ok.cuerpo as { id: string }).id).toBe(id);
    const nada = await pedir('/cargas/00000000-0000-4000-8000-000000000001');
    expect(nada.status).toBe(404);
    const malo = await pedir('/cargas/no-es-uuid');
    expect(malo.status).toBe(400);
  });

  it('GET /bancos/perfiles sirve un arreglo sin envoltorio', async () => {
    const { status, cuerpo } = await pedir('/bancos/perfiles');
    expect(status).toBe(200);
    expect(perfilesBancarios.parse(cuerpo)).toEqual(PERFILES);
  });

  it('una petición sin manejador sigue fallando', async () => {
    await expect(pedir('/cargas/otra-ruta/inexistente')).rejects.toThrow();
  });
});

// Estas pruebas leen un multipart real con `request.formData()`; dependen de
// que `setup.ts` restaure `File`/`Blob`/`FormData` nativos (spike M18, ADR-6).
describe('POST de subida con estado', () => {
  it('cfdi nuevo: 202 pendiente, la carga aparece primera en la lista y se registra la subida', async () => {
    const { status, cuerpo } = await pedir('/cargas/cfdi', {
      method: 'POST',
      body: formulario([
        ['archivos', 'a.xml'],
        ['archivos', 'b.xml'],
      ]),
    });
    expect(status).toBe(202);
    const carga = respuestaCarga.parse(cuerpo);
    expect(carga.estado).toBe('pendiente');
    expect(carga.yaExistia).toBe(false);
    const lista = respuestaListaCargas.parse((await pedir('/cargas')).cuerpo);
    expect(lista.datos[0]?.id).toBe(carga.id);
    expect(lista.datos).toHaveLength(20);
    expect(cargas.subidas()).toHaveLength(1);
    expect(cargas.subidas()[0]?.archivos.map((a) => a.nombre)).toEqual([
      'a.xml',
      'b.xml',
    ]);
  });

  it('el mismo lote responde 200 yaExistia con la misma carga', async () => {
    const primero = await pedir('/cargas/cfdi', {
      method: 'POST',
      body: formulario([['archivos', 'a.xml']]),
    });
    const segundo = await pedir('/cargas/cfdi', {
      method: 'POST',
      body: formulario([['archivos', 'a.xml']]),
    });
    expect(segundo.status).toBe(200);
    const repetida = respuestaCarga.parse(segundo.cuerpo);
    expect(repetida.yaExistia).toBe(true);
    expect(repetida.id).toBe(respuestaCarga.parse(primero.cuerpo).id);
  });

  it('resubir un lote fallido lo reencola: 200 yaExistia en pendiente y sin resultados', async () => {
    const primero = respuestaCarga.parse(
      (
        await pedir('/cargas/cfdi', {
          method: 'POST',
          body: formulario([['archivos', 'a.xml']]),
        })
      ).cuerpo,
    );
    cargas.avanzar(primero.id, 'fallida', {
      errorMensaje: 'La carga falló por un problema del sistema.',
    });
    const { status, cuerpo } = await pedir('/cargas/cfdi', {
      method: 'POST',
      body: formulario([['archivos', 'a.xml']]),
    });
    expect(status).toBe(200);
    const repetida = respuestaCarga.parse(cuerpo);
    expect(repetida.yaExistia).toBe(true);
    expect(repetida.estado).toBe('pendiente');
    expect(repetida.errorMensaje).toBeNull();
    const lista = respuestaListaCargas.parse((await pedir('/cargas')).cuerpo);
    expect(lista.datos.find((f) => f.id === primero.id)?.estado).toBe(
      'pendiente',
    );
  });

  it('cfdi valida como el servidor: sin archivos o con extensión ajena responde 400', async () => {
    const vacio = await pedir('/cargas/cfdi', {
      method: 'POST',
      body: formulario([]),
    });
    expect(vacio.status).toBe(400);
    const ajeno = await pedir('/cargas/cfdi', {
      method: 'POST',
      body: formulario([['archivos', 'factura.pdf']]),
    });
    expect(ajeno.status).toBe(400);
  });

  it('estado de cuenta: 202, campos de texto recibidos en orden y perfil desconocido 400', async () => {
    const ok = await pedir('/cargas/estado-cuenta', {
      method: 'POST',
      body: formulario([['archivo', 'movs.csv']], {
        banco: 'BBVA',
        perfil: 'banco-norte',
      }),
    });
    expect(ok.status).toBe(202);
    expect(cargas.subidas()[0]?.campos).toEqual([
      ['banco', 'BBVA'],
      ['perfil', 'banco-norte'],
    ]);
    const malo = await pedir('/cargas/estado-cuenta', {
      method: 'POST',
      body: formulario([['archivo', 'otro.csv']], { perfil: 'no-existe' }),
    });
    expect(malo.status).toBe(400);
  });

  it('avanzar mueve la carga en lista y detalle a la vez', async () => {
    const nueva = respuestaCarga.parse(
      (
        await pedir('/cargas/cfdi', {
          method: 'POST',
          body: formulario([['archivos', 'a.xml']]),
        })
      ).cuerpo,
    );
    cargas.avanzar(nueva.id, 'con_errores', {
      registrosOk: 1,
      registrosError: 2,
    });
    const detalle = (await pedir(`/cargas/${nueva.id}`)).cuerpo as {
      estado: string;
      registrosError: number;
    };
    expect(detalle.estado).toBe('con_errores');
    expect(detalle.registrosError).toBe(2);
    const fila = respuestaListaCargas
      .parse((await pedir('/cargas')).cuerpo)
      .datos.find((i) => i.id === nueva.id);
    expect(fila?.estado).toBe('con_errores');
    expect(fila?.registrosOk).toBe(1);
  });
});

describe('estado en memoria de los manejadores', () => {
  it('establecer reemplaza la lista y establecerDetalle fija el detalle', async () => {
    const fila = itemCarga(50, { nombreArchivo: 'solo.xml' });
    cargas.establecer([fila]);
    const lista = respuestaListaCargas.parse((await pedir('/cargas')).cuerpo);
    expect(lista.datos).toEqual([fila]);
    cargas.establecerDetalle(detalleCarga(50, { estado: 'procesando' }));
    const detalle = (await pedir(`/cargas/${fila.id}`)).cuerpo as {
      estado: string;
    };
    expect(detalle.estado).toBe('procesando');
  });

  it('una compuerta retiene la respuesta hasta que se abre', async () => {
    const compuerta = crearCompuerta();
    cargas.compuertas({ lista: compuerta.promesa });
    let resuelta = false;
    const espera = pedir('/cargas').then((r) => {
      resuelta = true;
      return r;
    });
    await Promise.resolve();
    expect(resuelta).toBe(false);
    compuerta.abrir();
    expect((await espera).status).toBe(200);
  });

  it('reiniciar devuelve lista, detalles y compuertas al arranque', async () => {
    cargas.establecer([itemCarga(50)]);
    cargas.establecerDetalle(detalleCarga(50, { estado: 'procesando' }));
    cargas.compuertas({ lista: crearCompuerta().promesa });
    cargas.reiniciar();
    expect(cargas.subidas()).toHaveLength(0);
    expect(cargas.filas()).toHaveLength(20);
    expect((await pedir('/cargas')).status).toBe(200);
  });
});

describe('ayudantes de fallo', () => {
  it('lista, detalle y perfiles responden el estado pedido', async () => {
    servidor.use(listaFalla(500), detalleFalla(403), perfilesFalla(503));
    expect((await pedir('/cargas')).status).toBe(500);
    expect((await pedir('/cargas/x')).status).toBe(403);
    expect((await pedir('/bancos/perfiles')).status).toBe(503);
  });

  it('la lista puede cortar la conexión', async () => {
    servidor.use(listaRedDeFallo());
    await expect(pedir('/cargas')).rejects.toThrow();
  });

  it('los POST fallan con 400, 413 con HTML, red y cuerpo fuera de contrato', async () => {
    servidor.use(...subidaFalla(400, 'Falta el archivo'));
    const cuatrocientos = await pedir('/cargas/cfdi', { method: 'POST' });
    expect(cuatrocientos.status).toBe(400);
    expect((cuatrocientos.cuerpo as { message: string }).message).toBe(
      'Falta el archivo',
    );

    servidor.use(...subida413Html());
    const grande = await pedir('/cargas/estado-cuenta', { method: 'POST' });
    expect(grande.status).toBe(413);
    expect(String(grande.cuerpo)).toContain('413');

    servidor.use(...subidaFueraDeContrato());
    const roto = await pedir('/cargas/cfdi', { method: 'POST' });
    expect(roto.status).toBe(202);
    expect(respuestaCarga.safeParse(roto.cuerpo).success).toBe(false);

    servidor.use(...subidaRedDeFallo());
    await expect(pedir('/cargas/cfdi', { method: 'POST' })).rejects.toThrow();
  });
});

describe('manejadores de la historia 3.1 (moneda)', () => {
  it('subidaCfdiConMonedaNoSoportada: 202 y un detalle con USD y EUR marcados', async () => {
    servidor.use(...subidaCfdiConMonedaNoSoportada());
    const subida = await pedir('/cargas/cfdi', { method: 'POST' });
    expect(subida.status).toBe(202);
    const creada = respuestaCarga.parse(subida.cuerpo);
    const detalle = await pedir(`/cargas/${creada.id}`);
    const parseado = respuestaCarga.parse({
      ...(detalle.cuerpo as object),
      yaExistia: false,
    });
    expect(parseado.estado).toBe('procesada');
    expect(
      parseado.resultados.map((r) =>
        'monedaNoSoportada' in r ? (r.moneda ?? null) : null,
      ),
    ).toEqual(['USD', 'EUR', null]);
  });

  it('subidaEstadoCuentaMonedaNoMxn: 400 con error moneda_no_mxn', async () => {
    servidor.use(subidaEstadoCuentaMonedaNoMxn());
    const r = await pedir('/cargas/estado-cuenta', { method: 'POST' });
    expect(r.status).toBe(400);
    expect(r.cuerpo).toEqual({
      statusCode: 400,
      message:
        'El estado de cuenta no está en MXN. Cuadra solo procesa estados de cuenta en pesos mexicanos.',
      error: 'moneda_no_mxn',
    });
  });
});
