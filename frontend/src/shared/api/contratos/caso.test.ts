import { describe, expect, it } from 'vitest';
import {
  respuestaCaso,
  respuestaComentario,
  respuestaDescarte,
  respuestaHistorial,
  respuestaReabrir,
  respuestaResolucion,
  type RespuestaCaso,
} from './caso';

const G = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Forma real de la API, con campos que el contrato ignora. */
const propuesta = (n: number, o: Record<string, unknown> = {}) => ({
  conciliacionId: G(100 + n),
  estado: 'propuesta',
  origen: 'regla',
  score: '0.9000',
  regla: 'monto_unico',
  motivo: 'Mismo monto',
  diferenciaMonto: '0.0000',
  confirmadaAt: null,
  confirmadaPor: null,
  requiereRevision: false,
  cfdi: {
    id: G(200 + n),
    uuidFiscal: `A1B2C3D4-0000-4000-8000-${String(n).padStart(12, '0')}`,
    serie: 'A',
    folio: String(1000 + n),
    nombreEmisor: 'Emisor SA',
    rfcReceptor: 'XAXX010101000',
    nombreReceptor: null,
    fechaEmision: '2026-09-01',
    total: '1160.0000',
    moneda: 'MXN',
    metodoPago: 'PUE',
    estado: 'abierta',
  },
  ...o,
});

const caso = (o: Record<string, unknown> = {}) => ({
  movimiento: {
    id: G(1),
    fecha: '2026-09-02',
    monto: '1160.0000',
    moneda: 'MXN',
    descripcion: 'SPEI recibido',
    referencia: null,
    estado: 'abierto',
  },
  estado: 'sugerencia',
  sinMatch: null,
  toleranciaMonto: '0.5000',
  requiereRevision: false,
  propuestas: [propuesta(1)],
  comentarios: [],
  puedeComentar: false,
  ...o,
});

const confirmada = (o: Record<string, unknown> = {}) =>
  propuesta(1, {
    estado: 'confirmada',
    confirmadaAt: '2026-09-03T15:04:05.000Z',
    confirmadaPor: { nombre: 'Ana' },
    ...o,
  });

describe('respuestaCaso: fixtures con la forma de CAS-3', () => {
  it('acepta una sugerencia con una propuesta', () => {
    expect(respuestaCaso.safeParse(caso()).success).toBe(true);
  });

  it('acepta varias propuestas, con score nulo al final', () => {
    const r = respuestaCaso.safeParse(
      caso({
        propuestas: [
          propuesta(1),
          propuesta(2, { score: '0.7000' }),
          propuesta(3, { score: null }),
        ],
      }),
    );
    expect(r.success).toBe(true);
  });

  it('acepta una propuesta de grupo con varias facturas y su confianza', () => {
    const p = propuesta(1, {
      regla: 'suma_grupo',
      score: '0.6000',
      confianza: 'media',
      cfdis: [propuesta(1).cfdi, propuesta(2).cfdi, propuesta(3).cfdi],
    });
    const r = respuestaCaso.parse(caso({ propuestas: [p] }));
    expect(r.propuestas[0]?.cfdis).toHaveLength(3);
    expect(r.propuestas[0]?.confianza).toBe('media');
  });

  it('rechaza una confianza que el backend no define y un total numérico en cfdis', () => {
    const mala = propuesta(1, { confianza: 'altisima' });
    expect(respuestaCaso.safeParse(caso({ propuestas: [mala] })).success).toBe(
      false,
    );
    const p = propuesta(1);
    const numerico = propuesta(1, { cfdis: [{ ...p.cfdi, total: 1160 }] });
    expect(
      respuestaCaso.safeParse(caso({ propuestas: [numerico] })).success,
    ).toBe(false);
  });

  it('acepta un sin_match con y sin registro', () => {
    for (const sinMatch of [
      { regla: 'sin_candidato_monto', motivo: 'Sin CFDI' },
      { regla: null, motivo: null },
    ]) {
      const r = respuestaCaso.safeParse(
        caso({ estado: 'sin_match', sinMatch, propuestas: [] }),
      );
      expect(r.success).toBe(true);
    }
  });

  it('acepta un conciliado con su confirmada', () => {
    const r = respuestaCaso.safeParse(
      caso({ estado: 'conciliado', propuestas: [confirmada()] }),
    );
    expect(r.success).toBe(true);
  });

  it('acepta una propuesta de origen llm con regla llm_sugerencia', () => {
    const r = respuestaCaso.safeParse(
      caso({
        propuestas: [propuesta(1, { origen: 'llm', regla: 'llm_sugerencia' })],
      }),
    );
    expect(r.success).toBe(true);
  });

  it('acepta los opcionales del CFDI en null', () => {
    const base = propuesta(1);
    const r = respuestaCaso.safeParse(
      caso({
        propuestas: [
          {
            ...base,
            cfdi: {
              ...base.cfdi,
              serie: null,
              folio: null,
              nombreEmisor: null,
              nombreReceptor: null,
              metodoPago: null,
            },
          },
        ],
      }),
    );
    expect(r.success).toBe(true);
  });
});

describe('respuestaCaso: dinero como cadena exacta', () => {
  it('conserva la precisión como texto (B1)', () => {
    const r = respuestaCaso.parse(
      caso({
        movimiento: {
          ...caso().movimiento,
          monto: '9007199254740993.1200',
        },
        propuestas: [propuesta(1, { diferenciaMonto: '-0.0040' })],
      }),
    ) as RespuestaCaso;
    expect(r.movimiento.monto).toBe('9007199254740993.1200');
    expect(r.propuestas[0]?.diferenciaMonto).toBe('-0.0040');
    expect(r.toleranciaMonto).toBe('0.5000');
  });

  it.each([
    [
      'monto',
      () => caso({ movimiento: { ...caso().movimiento, monto: 1160 } }),
    ],
    ['toleranciaMonto', () => caso({ toleranciaMonto: 0.5 })],
    [
      'diferenciaMonto',
      () => caso({ propuestas: [propuesta(1, { diferenciaMonto: 0 })] }),
    ],
    [
      'cfdi.total',
      () => {
        const p = propuesta(1);
        return caso({
          propuestas: [{ ...p, cfdi: { ...p.cfdi, total: 1160 } }],
        });
      },
    ],
  ])('rechaza %s como número', (_nombre, armar) => {
    expect(respuestaCaso.safeParse(armar()).success).toBe(false);
  });
});

describe('respuestaCaso: forma y dominio', () => {
  it('exige el estado de cada factura y lo valida contra el espejo (4.6)', () => {
    const base = propuesta(1);
    const probar = (cfdi: Record<string, unknown>) =>
      respuestaCaso.safeParse(
        caso({ propuestas: [{ ...base, cfdi, cfdis: [cfdi] }] }),
      ).success;
    const sin: Record<string, unknown> = { ...base.cfdi };
    delete sin.estado;
    expect(probar(sin)).toBe(false);
    expect(probar({ ...base.cfdi, estado: 'anulada' })).toBe(false);
    expect(probar({ ...base.cfdi, estado: 'cancelada' })).toBe(true);
  });

  it('ignora claves desconocidas', () => {
    const r = respuestaCaso.safeParse({ ...caso(), extra: 1 });
    expect(r.success).toBe(true);
  });

  it('rechaza un estado desconocido', () => {
    expect(respuestaCaso.safeParse(caso({ estado: 'borrado' })).success).toBe(
      false,
    );
  });

  it('deja pasar una regla desconocida como texto', () => {
    const r = respuestaCaso.parse(
      caso({ propuestas: [propuesta(1, { regla: 'regla_nueva' })] }),
    ) as RespuestaCaso;
    expect(r.propuestas[0]?.regla).toBe('regla_nueva');
  });

  it('exige el origen y lo valida contra el espejo (B3)', () => {
    const sinOrigen: Record<string, unknown> = { ...propuesta(1) };
    delete sinOrigen.origen;
    expect(
      respuestaCaso.safeParse(caso({ propuestas: [sinOrigen] })).success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({ propuestas: [propuesta(1, { origen: 'humano' })] }),
      ).success,
    ).toBe(false);
  });

  it('exige requiereRevision booleano en el caso y en cada propuesta (4.6)', () => {
    const sinCaso: Record<string, unknown> = { ...caso() };
    delete sinCaso.requiereRevision;
    expect(respuestaCaso.safeParse(sinCaso).success).toBe(false);
    const sinPropuesta: Record<string, unknown> = { ...propuesta(1) };
    delete sinPropuesta.requiereRevision;
    expect(
      respuestaCaso.safeParse(caso({ propuestas: [sinPropuesta] })).success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(caso({ requiereRevision: 'true' })).success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({ propuestas: [propuesta(1, { requiereRevision: 1 })] }),
      ).success,
    ).toBe(false);
  });

  it('acepta una confirmada que requiere revisión', () => {
    const r = respuestaCaso.parse(
      caso({
        estado: 'conciliado',
        requiereRevision: true,
        propuestas: [confirmada({ requiereRevision: true })],
      }),
    ) as RespuestaCaso;
    expect(r.requiereRevision).toBe(true);
    expect(r.propuestas[0]?.requiereRevision).toBe(true);
  });

  it('rechaza una fecha de movimiento que no es AAAA-MM-DD', () => {
    expect(
      respuestaCaso.safeParse(
        caso({ movimiento: { ...caso().movimiento, fecha: '02/09/2026' } }),
      ).success,
    ).toBe(false);
  });

  it('rechaza un conciliacionId que no es guid', () => {
    expect(
      respuestaCaso.safeParse(
        caso({ propuestas: [propuesta(1, { conciliacionId: '42' })] }),
      ).success,
    ).toBe(false);
  });
});

describe('respuestaCaso: coherencia entre estado y propuestas', () => {
  it('conciliado sin exactamente una confirmada falla', () => {
    expect(
      respuestaCaso.safeParse(caso({ estado: 'conciliado', propuestas: [] }))
        .success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({ estado: 'conciliado', propuestas: [propuesta(1)] }),
      ).success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({
          estado: 'conciliado',
          propuestas: [confirmada(), confirmada({ conciliacionId: G(150) })],
        }),
      ).success,
    ).toBe(false);
  });

  it('sugerencia sin propuestas, o con una confirmada, falla', () => {
    expect(
      respuestaCaso.safeParse(caso({ estado: 'sugerencia', propuestas: [] }))
        .success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({
          estado: 'sugerencia',
          propuestas: [propuesta(1), confirmada()],
        }),
      ).success,
    ).toBe(false);
  });

  it('sin_match con propuestas falla', () => {
    expect(
      respuestaCaso.safeParse(
        caso({
          estado: 'sin_match',
          sinMatch: null,
          propuestas: [propuesta(1)],
        }),
      ).success,
    ).toBe(false);
  });
});

describe('respuestaResolucion', () => {
  const resolucion = (o: Record<string, unknown> = {}) => ({
    id: G(101),
    estado: 'confirmada',
    cfdiId: G(201),
    movimientoId: G(1),
    motivo: null,
    confirmadaAt: '2026-09-03T15:04:05.000Z',
    rechazadasAutomaticamente: [G(102), G(103)],
    ...o,
  });

  it('acepta una confirmación con dos hermanas rechazadas', () => {
    const r = respuestaResolucion.parse(resolucion());
    expect(r.rechazadasAutomaticamente).toHaveLength(2);
  });

  it('acepta cfdiIds de un grupo y sigue aceptando la respuesta sin él', () => {
    const r = respuestaResolucion.parse(
      resolucion({ cfdiIds: [G(201), G(202), G(203)] }),
    );
    expect(r.cfdiIds).toHaveLength(3);
    expect(respuestaResolucion.parse(resolucion()).cfdiIds).toBeUndefined();
    expect(
      respuestaResolucion.safeParse(resolucion({ cfdiIds: ['x'] })).success,
    ).toBe(false);
  });

  it('acepta un rechazo con arreglo vacío y sin confirmadaAt', () => {
    const r = respuestaResolucion.safeParse(
      resolucion({
        estado: 'rechazada',
        confirmadaAt: null,
        rechazadasAutomaticamente: [],
        motivo: 'No corresponde',
      }),
    );
    expect(r.success).toBe(true);
  });

  it('rechaza el estado "propuesta"', () => {
    expect(
      respuestaResolucion.safeParse(resolucion({ estado: 'propuesta' }))
        .success,
    ).toBe(false);
  });

  it('rechaza ids hermanas que no son guid', () => {
    expect(
      respuestaResolucion.safeParse(
        resolucion({ rechazadasAutomaticamente: ['x'] }),
      ).success,
    ).toBe(false);
  });
});

describe('respuestaHistorial', () => {
  const evento = (o: Record<string, unknown> = {}) => ({
    id: G(900),
    entidad: 'conciliacion',
    entidadId: G(101),
    accion: 'crear',
    createdAt: '2026-09-03T15:04:05.000Z',
    usuario: { nombre: 'Ana', email: 'ana@fdb.mx' },
    datos: { ip: '10.0.0.1', ids: [G(1)] },
    ...o,
  });

  it('acepta un actor nulo (Sistema)', () => {
    const r = respuestaHistorial.parse({ datos: [evento({ usuario: null })] });
    expect(r.datos[0]?.usuario).toBeNull();
  });

  it('no expone datos, email ni ip', () => {
    const r = respuestaHistorial.parse({ datos: [evento()] });
    const texto = JSON.stringify(r);
    expect(texto).not.toContain('10.0.0.1');
    expect(texto).not.toContain('ana@fdb.mx');
    expect(r.datos[0]).not.toHaveProperty('datos');
  });

  it('deja pasar una acción desconocida como texto', () => {
    const r = respuestaHistorial.parse({
      datos: [evento({ accion: 'accion_nueva' })],
    });
    expect(r.datos[0]?.accion).toBe('accion_nueva');
  });

  it('acepta una lista vacía y rechaza una fecha inválida', () => {
    expect(respuestaHistorial.safeParse({ datos: [] }).success).toBe(true);
    expect(
      respuestaHistorial.safeParse({
        datos: [evento({ createdAt: 'ayer' })],
      }).success,
    ).toBe(false);
  });
});

const DESCARTE = {
  motivo: 'Comisión bancaria',
  por: 'Luis Reyes',
  fecha: '2026-10-05T10:00:00.000Z',
  puedeDeshacer: true,
};

const descartado = (descarte: unknown = DESCARTE) =>
  caso({
    movimiento: { ...caso().movimiento, estado: 'descartado' },
    estado: 'sin_match',
    sinMatch: null,
    propuestas: [],
    descarte,
  });

describe('respuestaCaso: el descarte (5.6)', () => {
  it('sigue aceptando un caso sin la clave descarte (respuesta anterior)', () => {
    const r = respuestaCaso.parse(caso());
    expect(r.descarte ?? null).toBeNull();
  });

  it('acepta descarte nulo y el objeto completo', () => {
    expect(respuestaCaso.parse(caso({ descarte: null })).descarte).toBeNull();
    expect(respuestaCaso.parse(descartado()).descarte).toEqual(DESCARTE);
  });

  it('acepta quien y cuando nulos, pero exige puedeDeshacer booleano', () => {
    const sinDatos = { ...DESCARTE, por: null, fecha: null };
    expect(respuestaCaso.safeParse(descartado(sinDatos)).success).toBe(true);
    const mala = { ...DESCARTE, puedeDeshacer: 'si' };
    expect(respuestaCaso.safeParse(descartado(mala)).success).toBe(false);
  });

  it('rechaza un descarte con propuestas: el cliente no inventa coherencia', () => {
    const incoherente = { ...descartado(), propuestas: [propuesta(1)] };
    expect(respuestaCaso.safeParse(incoherente).success).toBe(false);
  });
});

describe('respuestaDescarte: POST descartar y deshacer-descarte', () => {
  const base = { id: G(9), movimientoId: G(1), motivo: 'Comisión bancaria' };

  it('acepta descartada y reabierta', () => {
    for (const estado of ['descartada', 'reabierta']) {
      expect(respuestaDescarte.parse({ ...base, estado }).estado).toBe(estado);
    }
  });

  it('rechaza un estado que no es del descarte', () => {
    expect(
      respuestaDescarte.safeParse({ ...base, estado: 'confirmada' }).success,
    ).toBe(false);
  });
});

describe('puedeReabrir del caso (5.7)', () => {
  const crudo = (o: Record<string, unknown> = {}) => ({
    movimiento: {
      id: G(1),
      fecha: '2026-09-02',
      monto: '1160.0000',
      moneda: 'MXN',
      descripcion: 'SPEI',
      referencia: null,
    },
    estado: 'sin_match',
    sinMatch: { regla: null, motivo: null },
    toleranciaMonto: '0.5000',
    requiereRevision: false,
    propuestas: [],
    comentarios: [],
    puedeComentar: false,
    ...o,
  });

  it('una respuesta sin puedeReabrir sigue siendo válida y vale false', () => {
    const r = respuestaCaso.parse(crudo());
    expect(r.puedeReabrir).toBe(false);
  });

  it('conserva puedeReabrir cuando el servidor lo manda', () => {
    expect(
      respuestaCaso.parse(crudo({ puedeReabrir: true })).puedeReabrir,
    ).toBe(true);
  });

  it('rechaza un puedeReabrir que no es booleano', () => {
    expect(respuestaCaso.safeParse(crudo({ puedeReabrir: 'si' })).success).toBe(
      false,
    );
  });
});

describe('respuestaReabrir: POST reabrir (5.7)', () => {
  const base = {
    id: G(1),
    estado: 'reabierta',
    movimientoId: G(2),
    cfdiIds: [G(3)],
    motivo: 'Confirmé el CFDI equivocado',
  };

  it('acepta la respuesta del servidor', () => {
    expect(respuestaReabrir.parse(base).estado).toBe('reabierta');
  });

  it('rechaza otro estado', () => {
    expect(
      respuestaReabrir.safeParse({ ...base, estado: 'confirmada' }).success,
    ).toBe(false);
  });
});

describe('respuestaHistorial: motivo de la reapertura (5.7)', () => {
  const evento = (datos: unknown) => ({
    id: G(900),
    entidad: 'decisiones',
    entidadId: G(101),
    accion: 'reabrir',
    createdAt: '2026-10-06T10:00:00.000Z',
    usuario: { nombre: 'Luis Reyes' },
    datos,
  });

  it('expone solo el motivo del evento, no el resto de datos', () => {
    const r = respuestaHistorial.parse({
      datos: [
        evento({ motivo: 'Confirmé el CFDI equivocado', ip: '10.0.0.1' }),
      ],
    });
    expect(r.datos[0]?.motivo).toBe('Confirmé el CFDI equivocado');
    expect(JSON.stringify(r)).not.toContain('10.0.0.1');
    expect(r.datos[0]).not.toHaveProperty('datos');
  });

  it('un evento sin motivo (o con datos ilegibles) sigue siendo válido', () => {
    const r = respuestaHistorial.parse({
      datos: [evento(null), evento([1, 2]), evento({ motivo: 7 })],
    });
    expect(r.datos.map((e) => e.motivo)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('comentarios del caso (5.9)', () => {
  const comentario = (o: Record<string, unknown> = {}) => ({
    id: G(300),
    decisionId: G(101),
    texto: 'No me convence: parece de otra obra.',
    por: 'Jorge Tapia',
    fecha: '2026-10-05T16:40:00.000Z',
    ...o,
  });
  const sinCampo = (campo: string) => {
    const resto: Record<string, unknown> = { ...caso() };
    delete resto[campo];
    return resto;
  };

  it('acepta comentarios y puedeComentar tal como los manda el servidor', () => {
    const r = respuestaCaso.parse(
      caso({ comentarios: [comentario()], puedeComentar: true }),
    );
    expect(r.puedeComentar).toBe(true);
    expect(r.comentarios).toEqual([comentario()]);
  });

  it('rechaza una respuesta sin comentarios', () => {
    expect(respuestaCaso.safeParse(sinCampo('comentarios')).success).toBe(
      false,
    );
  });

  it('rechaza una respuesta sin puedeComentar', () => {
    expect(respuestaCaso.safeParse(sinCampo('puedeComentar')).success).toBe(
      false,
    );
  });

  it('rechaza un puedeComentar que no es booleano', () => {
    expect(respuestaCaso.safeParse(caso({ puedeComentar: 'si' })).success).toBe(
      false,
    );
  });

  it.each([
    ['sin texto', { texto: undefined }],
    ['sin autor', { por: undefined }],
    ['con fecha que no es ISO', { fecha: 'ayer' }],
    ['con una decisión que no es uuid', { decisionId: 'x' }],
  ])('rechaza un comentario %s', (_nombre, cambio) => {
    expect(
      respuestaCaso.safeParse(caso({ comentarios: [comentario(cambio)] }))
        .success,
    ).toBe(false);
  });
});

describe('respuestaComentario: POST comentarios (5.9)', () => {
  const base = {
    id: G(300),
    decisionId: G(101),
    texto: 'Lo reviso con el cliente.',
    por: 'Luis Reyes',
    fecha: '2026-10-06T09:05:00.000Z',
  };

  it('acepta la respuesta del servidor', () => {
    expect(respuestaComentario.parse(base)).toEqual(base);
  });

  it('rechaza una respuesta sin texto', () => {
    const sinTexto: Record<string, unknown> = { ...base };
    delete sinTexto.texto;
    expect(respuestaComentario.safeParse(sinTexto).success).toBe(false);
  });
});

describe('respuestaHistorial: texto del comentario (5.9)', () => {
  const evento = (datos: unknown) => ({
    id: G(901),
    entidad: 'decisiones',
    entidadId: G(101),
    accion: 'comentar',
    createdAt: '2026-10-06T10:00:00.000Z',
    usuario: { nombre: 'Luis Reyes' },
    datos,
  });

  it('expone el texto del comentario y descarta el resto de datos', () => {
    const r = respuestaHistorial.parse({
      datos: [
        evento({ comentarioId: G(300), texto: 'Revisar con el cliente' }),
      ],
    });
    expect(r.datos[0]?.texto).toBe('Revisar con el cliente');
    expect(r.datos[0]).not.toHaveProperty('datos');
  });

  it('un texto que no es cadena no se expone', () => {
    const r = respuestaHistorial.parse({ datos: [evento({ texto: 7 })] });
    expect(r.datos[0]).not.toHaveProperty('texto');
  });
});
