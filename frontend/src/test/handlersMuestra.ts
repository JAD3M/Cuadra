import { http, HttpResponse } from 'msw';
import type { CasoMuestra, RespuestaMuestra } from '@/shared/api/contratos';
import { USUARIO } from '@/test/fixtures';

// Manejadores de la muestra de verificación (historia 9.4) con las reglas del
// backend:
//  - `GET /muestra?mes=AAAA-MM`: sin `mes`, el más reciente con muestra; 400 si
//    el mes no es `AAAA-MM`; un mes sin muestra responde `mes: null`.
//  - `POST /muestra/casos/:decisionId/verificar`: agrega la marca (la última
//    vale), recalcula el avance y la deja en `marcas`; 400 resultado inválido,
//    404 caso ajeno, 409 caso reabierto. `opciones.estado` fuerza un fallo.
// El estado vive en memoria: `reiniciar()` lo devuelve al de arranque.

const ERROR_NEST = (status: number, mensaje: string | string[]) =>
  HttpResponse.json(
    { statusCode: status, error: 'Error', message: mensaje },
    { status },
  );

const CFDI = {
  id: 'cfdi-1',
  uuidFiscal: '0b9d2f6e-1111-4a2b-8c3d-aaaaaaaaaaaa',
  serie: 'A',
  folio: '1044',
  nombreEmisor: 'Materiales Reyes S.A. de C.V.',
  nombreReceptor: 'Ferretería del Bajío',
  total: '18560.0000',
  moneda: 'MXN',
};

/** Un caso de la muestra con los valores del mockup; `extra` pisa lo que haga falta. */
export function casoMuestra(
  n: number,
  extra: Partial<CasoMuestra> = {},
): CasoMuestra {
  return {
    decisionId: `dec-${n}`,
    movimientoId: `mov-${n}`,
    fecha: '2026-09-12',
    descripcion: `SPEI MATERIALES REYES ${n}`,
    referencia: `A-10${n}`,
    monto: '18560.4000',
    moneda: 'MXN',
    banco: 'BBVA',
    regla: 'referencia_monto_exacto',
    motivo: `La referencia A-10${n} coincide con el CFDI.`,
    cfdis: [CFDI],
    confirmadaPor: 'Marta Salas',
    confirmadaPorMi: false,
    confirmadaAt: '2026-09-12T16:00:00.000Z',
    marca: 'pendiente',
    marcadaPor: null,
    marcadaAt: null,
    marcas: [],
    reabierta: false,
    puedeMarcar: true,
    ...extra,
  };
}

/** Recalcula el avance a partir de los casos, como lo hace el servidor. */
export function conAvance(
  base: Omit<RespuestaMuestra, 'avance'>,
): RespuestaMuestra {
  const { casos } = base;
  return {
    ...base,
    avance: {
      total: casos.length,
      conformes: casos.filter((c) => c.marca === 'conforme').length,
      desacuerdos: casos.filter((c) => c.marca === 'desacuerdo').length,
      pendientes: casos.filter((c) => c.marca === 'pendiente' && !c.reabierta)
        .length,
      reabiertas: casos.filter((c) => c.reabierta).length,
    },
  };
}

export const MUESTRA_INICIAL: RespuestaMuestra = conAvance({
  mes: '2026-09',
  meses: ['2026-09', '2026-08'],
  sinRevisor: false,
  puedeVerificar: true,
  casos: [casoMuestra(1), casoMuestra(2), casoMuestra(3)],
});

export interface OpcionesMuestra {
  /** El POST responde con este estado (403, 404, 409, 500…). */
  estado?: number;
  /** Nombre de quien marca; por omisión, el de la sesión de pruebas. */
  quien?: string;
}

export function crearHandlersMuestra() {
  let porMes = new Map<string, RespuestaMuestra>([
    ['2026-09', MUESTRA_INICIAL],
  ]);
  let opciones: OpcionesMuestra = {};
  const posts: Array<{ decisionId: string; cuerpo: unknown }> = [];
  const lecturas: Array<string | null> = [];

  function lectura(mes: string | null): RespuestaMuestra {
    const clave = mes ?? [...porMes.keys()].sort().reverse()[0] ?? null;
    const encontrada = clave === null ? undefined : porMes.get(clave);
    if (encontrada !== undefined) return encontrada;
    const alguna = [...porMes.values()][0];
    return conAvance({
      mes: null,
      meses: alguna?.meses ?? [],
      sinRevisor: alguna?.sinRevisor ?? false,
      puedeVerificar: alguna?.puedeVerificar ?? true,
      casos: [],
    });
  }

  const handlers = [
    http.get('/api/muestra', ({ request }) => {
      const mes = new URL(request.url).searchParams.get('mes');
      lecturas.push(mes);
      if (mes !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
        return ERROR_NEST(400, 'El mes debe tener la forma AAAA-MM');
      }
      return HttpResponse.json(lectura(mes));
    }),
    http.post(
      '/api/muestra/casos/:decisionId/verificar',
      async ({ params, request }) => {
        const decisionId = String(params.decisionId);
        const cuerpo = (await request.json()) as { resultado?: unknown };
        posts.push({ decisionId, cuerpo });
        if (opciones.estado !== undefined) {
          return ERROR_NEST(opciones.estado, 'No');
        }
        if (
          cuerpo.resultado !== 'conforme' &&
          cuerpo.resultado !== 'desacuerdo'
        ) {
          return ERROR_NEST(
            400,
            'El resultado debe ser «conforme» o «desacuerdo»',
          );
        }
        for (const [mes, muestra] of porMes) {
          const caso = muestra.casos.find((c) => c.decisionId === decisionId);
          if (caso === undefined) continue;
          if (caso.reabierta)
            return ERROR_NEST(409, 'El caso ya fue reabierto');
          const cuando = '2026-11-22T16:42:00.000Z';
          const quien = opciones.quien ?? USUARIO.nombre;
          const nuevo: CasoMuestra = {
            ...caso,
            marca: cuerpo.resultado,
            marcadaPor: quien,
            marcadaAt: cuando,
            marcas: [
              { quien, resultado: cuerpo.resultado, cuando },
              ...caso.marcas,
            ],
          };
          porMes.set(
            mes,
            conAvance({
              ...muestra,
              casos: muestra.casos.map((c) =>
                c.decisionId === decisionId ? nuevo : c,
              ),
            }),
          );
          return HttpResponse.json(
            {
              decisionId,
              marca: cuerpo.resultado,
              marcadaPor: quien,
              marcadaAt: cuando,
            },
            { status: 201 },
          );
        }
        return ERROR_NEST(404, 'El caso no está en la muestra');
      },
    ),
  ];

  return {
    handlers,
    /** Pedidos `POST` recibidos, en orden. */
    posts,
    /** Meses pedidos al `GET`, en orden (`null`: sin `mes`). */
    lecturas,
    /** Fija las muestras que sirve, por mes. */
    establecer(muestras: readonly RespuestaMuestra[]) {
      porMes = new Map(
        muestras.flatMap((m) => (m.mes === null ? [] : [[m.mes, m]])),
      );
    },
    opciones(nuevas: OpcionesMuestra) {
      opciones = nuevas;
    },
    reiniciar() {
      porMes = new Map([['2026-09', MUESTRA_INICIAL]]);
      opciones = {};
      posts.length = 0;
      lecturas.length = 0;
    },
  };
}
