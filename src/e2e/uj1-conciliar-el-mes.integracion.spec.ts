import type { DataSource } from 'typeorm';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { filas } from '../database/testing/base-de-pruebas';
import {
  cfdiDeEjemploPara,
  leerEjemplo as leer,
  levantarRecorrido,
  type Recorrido,
} from '../testing/recorrido-de-pruebas';
import { PDF_CUADRA, PDF_NO_CUADRA } from '../../scripts/ejemplos/generar';
import { FACTURAS, MOVIMIENTOS } from '../../scripts/ejemplos/juego';

/**
 * Historia 7.3 (FR-70, AD-18). UJ-1, «Marisol concilia el mes», de punta a
 * punta por HTTP: la API, Postgres con RLS (cuadra_app) y Redis reales, con el
 * juego de ejemplo de la historia 7.1. La empresa se crea como en la historia
 * 7.2: el dueño de la plataforma la da de alta e invita a su administrador, que
 * invita al resto del equipo por correo. Un solo recorrido encadenado: cada paso
 * usa lo que dejó el anterior. La contadora sube; la administradora confirma,
 * porque quien sube no puede confirmar (D-08).
 */

jest.setTimeout(120_000);

const CORREO_DUENO = 'dueno-uj1@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const DOMINIO = 'uj1.test';
const RFC_A = 'UJA240101AB1';
const RFC_B = 'UJB240202BC2';
const CORREO_ADMIN = `admin@${DOMINIO}`;
const CORREO_CONTADORA = `contadora@${DOMINIO}`;
const CORREO_ADMIN_B = `admin-b@${DOMINIO}`;

let r: Recorrido;
let ds: DataSource;
let A: string;
let B: string;
let tokenLuis: string;
let tokenAna: string;
let tokenOtra: string;

const http = () => r.http();
const cfdiDeLaEmpresa = (folio: string) => cfdiDeEjemploPara(RFC_A, folio);
const aceptar = async (para: string, nombre: string) =>
  (await r.aceptar(para, nombre)).cookie;

beforeAll(async () => {
  r = await levantarRecorrido({
    prefijo: 'cuadra_test_uj1',
    dominio: DOMINIO,
    rfcs: [RFC_A, RFC_B],
    correoDueno: CORREO_DUENO,
    passwordDueno: PASSWORD_DUENO,
    conDominio: true,
  });
  ({ ds } = r);
}, 60_000);

afterAll(async () => {
  await r?.cerrar();
});

const subirPdf = (nombre: string, ruta: string) =>
  http()
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', tokenLuis)
    .field('banco', 'bbva')
    .attach('archivo', leer(ruta), nombre);

interface FilaBandeja {
  movimientoId: string;
  descripcion: string;
  estado: string;
  regla: string | null;
  motivoBloqueo: string | null;
  propuestasCount: number;
  mejorPropuesta: {
    conciliacionId: string;
    score: string | null;
    cfdis: { folio: string; estado: string }[];
  } | null;
}

async function bandeja(token: string, estados: string[]) {
  const res = await http()
    .get('/bandeja')
    .query({ estado: estados, limite: 100 })
    .set('Cookie', token)
    .expect(200);
  return (res.body as { datos: FilaBandeja[] }).datos;
}

describe('UJ-1: Marisol concilia el mes (FR-70)', () => {
  it('la empresa se crea como en la historia 7.2: el dueño la da de alta y el equipo entra por invitación', async () => {
    const cookieDueno = await r.iniciarDueno();
    A = await r.crearEmpresa(
      cookieDueno,
      'Ferretería del recorrido SA de CV',
      RFC_A,
      CORREO_ADMIN,
    );
    B = await r.crearEmpresa(
      cookieDueno,
      'Otra empresa del recorrido SA de CV',
      RFC_B,
      CORREO_ADMIN_B,
    );

    tokenAna = await aceptar(CORREO_ADMIN, 'Ana, administradora');
    tokenOtra = await aceptar(CORREO_ADMIN_B, 'Beto, administrador');
    await http()
      .post('/usuarios/invitaciones')
      .set('Cookie', tokenAna)
      .send({ email: CORREO_CONTADORA, roles: ['contador'] })
      .expect(201);
    tokenLuis = await aceptar(CORREO_CONTADORA, 'Marisol, contadora');

    const contexto = await http()
      .get('/auth/contexto')
      .set('Cookie', tokenLuis)
      .expect(200);
    expect((contexto.body as { empresa: { id: string } }).empresa.id).toBe(A);
  });

  it('el PDF que no cuadra se rechaza completo; el que cuadra entra al aceptar la vista previa', async () => {
    const mal = await subirPdf('no-cuadra.pdf', PDF_NO_CUADRA).expect(400);
    expect(mal.body).toMatchObject({
      error: 'saldos_no_cuadran',
      diferencia: '100',
    });
    const [{ n }] = await filas<{ n: string }>(
      ds,
      `SELECT (SELECT count(*) FROM movimientos) + (SELECT count(*) FROM movimientos_pendientes) AS n`,
    );
    expect(Number(n)).toBe(0);

    const carga = await subirPdf('septiembre.pdf', PDF_CUADRA).expect(200);
    const cargaId = (carga.body as { cargaId: string }).cargaId;
    await http()
      .post(`/cargas/${cargaId}/aceptar`)
      .set('Cookie', tokenLuis)
      .expect(200);

    const [{ n: movs }] = await filas<{ n: string }>(
      ds,
      `SELECT count(*) AS n FROM movimientos WHERE company_id = $1`,
      [A],
    );
    expect(Number(movs)).toBe(MOVIMIENTOS.length);
  });

  it('con los CFDI del mes el motor propone, ordenado por confianza, y marca lo que no puede', async () => {
    const cfdi = http().post('/cargas/cfdi').set('Cookie', tokenLuis);
    for (const f of FACTURAS) {
      cfdi.attach('archivos', cfdiDeLaEmpresa(f.folio), `${f.folio}.xml`);
    }
    const subida = await cfdi.expect(202);
    const fin = await r.esperarFin(
      tokenLuis,
      (subida.body as { id: string }).id,
    );
    expect(fin).toMatchObject({ estado: 'procesada', registrosOk: 9 });
    // La factura en dólares queda marcada «moneda no soportada».
    expect(fin.resultados).toContainEqual(
      expect.objectContaining({
        archivo: '5009.xml',
        moneda: 'USD',
        monedaNoSoportada: true,
      }),
    );

    await r.app.get(ConciliacionService).conciliar(A);

    const sugerencias = await bandeja(tokenLuis, ['sugerencia']);
    // Ordenadas por confianza, de mayor a menor.
    const scores = sugerencias.map((f) => Number(f.mejorPropuesta?.score));
    expect(scores).toEqual([1, 0.6, 0.5, 0.4]);
    expect(sugerencias.map((f) => f.regla)).toEqual([
      'referencia_monto_exacto',
      'suma_grupo',
      'referencia_monto_diferente',
      'monto_unico',
    ]);
    // El depósito con varias facturas es una sola propuesta de dos CFDI.
    const grupo = sugerencias[1];
    expect(grupo.mejorPropuesta?.cfdis.map((c) => c.folio)).toEqual([
      '5004',
      '5005',
    ]);
    // Los dos sin pareja caen en «sin_match» con su razón, sin propuesta.
    const sinMatch = await bandeja(tokenLuis, ['sin_match']);
    expect(sinMatch.map((f) => f.regla).sort()).toEqual([
      'monto_multiples_candidatos',
      'sin_candidato_monto',
    ]);
    expect(sinMatch.every((f) => f.propuestasCount === 0)).toBe(true);
  });

  let regla1: string;
  let grupoId: string;
  let loteId: string;

  it('el lote de la regla 1 lo confirma Ana con un solo lote_id; Luis, que subió los archivos, no puede', async () => {
    const sug = await bandeja(tokenAna, ['sugerencia']);
    regla1 = sug[0].mejorPropuesta!.conciliacionId;
    grupoId = sug[1].mejorPropuesta!.conciliacionId;
    expect(sug[0].regla).toBe('referencia_monto_exacto');

    // Separación de funciones: Luis lo ve bloqueado y el lote lo omite.
    const deLuis = await bandeja(tokenLuis, ['sugerencia']);
    expect(deLuis[0].motivoBloqueo).toBe('separacion_de_funciones');
    expect(sug[0].motivoBloqueo).toBeNull();
    const rechazado = await http()
      .post('/conciliaciones/lotes')
      .set('Cookie', tokenLuis)
      .send({ ids: [regla1] })
      .expect(200);
    expect(rechazado.body).toMatchObject({ confirmadas: [], loteId: null });

    // Ana marca la regla 1 y desmarca el depósito de varias facturas.
    const res = await http()
      .post('/conciliaciones/lotes')
      .set('Cookie', tokenAna)
      .send({ ids: [regla1], desmarcadas: [grupoId] })
      .expect(200);
    const cuerpo = res.body as {
      loteId: string;
      confirmadas: string[];
      omitidas: unknown[];
    };
    expect(cuerpo.confirmadas).toEqual([regla1]);
    expect(cuerpo.omitidas).toEqual([]);
    loteId = cuerpo.loteId;

    const decisiones = await filas<{
      id: string;
      estado: string;
      lote_id: string | null;
    }>(
      ds,
      `SELECT id, estado, lote_id FROM decisiones
        WHERE company_id = $1 AND (estado = 'confirmada' OR id = $2)
        ORDER BY id`,
      [A, grupoId],
    );
    const confirmadas = decisiones.filter((d) => d.estado === 'confirmada');
    expect(confirmadas.map((d) => d.id)).toEqual([regla1]);
    expect(new Set(confirmadas.map((d) => d.lote_id))).toEqual(
      new Set([loteId]),
    );
    // La desmarcada sigue siendo propuesta, sin lote.
    expect(decisiones.find((d) => d.id === grupoId)).toMatchObject({
      estado: 'propuesta',
      lote_id: null,
    });
  });

  it('un movimiento que no es de ningún cliente se descarta con motivo, sale de la bandeja y se puede deshacer', async () => {
    const [zeta] = (await bandeja(tokenLuis, ['sin_match'])).filter(
      (f) => f.regla === 'sin_candidato_monto',
    );

    await http()
      .post(`/movimientos/${zeta.movimientoId}/descartar`)
      .set('Cookie', tokenLuis)
      .send({ motivo: 'Depósito de un familiar, no es de un cliente' })
      .expect(200);
    const sin = await bandeja(tokenLuis, ['sugerencia', 'sin_match']);
    expect(sin.map((f) => f.movimientoId)).not.toContain(zeta.movimientoId);

    await http()
      .post(`/movimientos/${zeta.movimientoId}/deshacer-descarte`)
      .set('Cookie', tokenLuis)
      .expect(200);
    const de_nuevo = await bandeja(tokenLuis, ['sin_match']);
    expect(de_nuevo.map((f) => f.movimientoId)).toContain(zeta.movimientoId);
  });

  it('una confirmación hecha por error se reabre con motivo: vuelve a la bandeja y la bitácora conserva quién y cuándo', async () => {
    const res = await http()
      .post(`/conciliaciones/lotes/${loteId}/reabrir`)
      .set('Cookie', tokenAna)
      .send({ motivo: 'Se confirmó con el cliente equivocado' })
      .expect(200);
    expect((res.body as { reabiertas: string[] }).reabiertas).toEqual([regla1]);

    const sug = await bandeja(tokenAna, ['sugerencia']);
    expect(sug.map((f) => f.regla)).toContain('referencia_monto_exacto');

    const bit = await http()
      .get('/bitacora')
      .query({ accion: 'reabrir', limite: 50 })
      .set('Cookie', tokenAna)
      .expect(200);
    const eventos = (
      bit.body as {
        datos: {
          entidadId: string | null;
          createdAt: string;
          usuario: { email: string } | null;
        }[];
      }
    ).datos.filter((e) => e.entidadId === regla1);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].usuario?.email).toBe(CORREO_ADMIN);
    expect(Number.isNaN(Date.parse(eventos[0].createdAt))).toBe(false);
  });

  it('con la sesión de la primera empresa nunca se ven los datos de la otra', async () => {
    const { id } = (
      await filas<{ id: string }>(
        ds,
        `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, estado, regla_sin_match, motivo_sin_match)
         VALUES ($1, 1, '2026-09-02', 'SPEI DE OTRA EMPRESA', '999.00', 'abierto', 'sin_candidato_monto', 'Sin candidato') RETURNING id`,
        [B],
      )
    )[0];

    const deAna = await bandeja(tokenAna, ['sugerencia', 'sin_match']);
    expect(deAna.map((f) => f.movimientoId)).not.toContain(id);
    await http().get(`/casos/${id}`).set('Cookie', tokenAna).expect(404);

    // Y al revés: la sesión de la otra empresa no ve nada de Ferretería.
    const deCarmen = await bandeja(tokenOtra, [
      'sugerencia',
      'sin_match',
      'conciliado',
    ]);
    expect(deCarmen.map((f) => f.movimientoId)).toEqual([id]);
  });
});
