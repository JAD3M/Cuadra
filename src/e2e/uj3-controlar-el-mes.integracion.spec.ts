import type { DataSource } from 'typeorm';
import { permisosDeRoles } from '../auth/permisos/matriz';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { filas } from '../database/testing/base-de-pruebas';
import {
  cfdiDeEjemploPara,
  leerEjemplo as leer,
  levantarRecorrido,
  type Recorrido,
} from '../testing/recorrido-de-pruebas';
import { PDF_CUADRA } from '../../scripts/ejemplos/generar';
import { FACTURAS } from '../../scripts/ejemplos/juego';

/**
 * Historia 7.4 (FR-70, AD-18, AD-11). UJ-3, «Pedro controla que el mes sea
 * confiable», de punta a punta por HTTP: la API, Postgres con RLS (cuadra_app)
 * y Redis reales, con el juego de ejemplo de la historia 7.1. La empresa se crea como en la historia
 * 7.2: el dueño de la plataforma la da de alta e invita a su administradora, que
 * invita a la contadora, al revisor y a la auditora. Un solo recorrido
 * encadenado: cada paso usa lo que dejó el anterior. La contadora sube; la
 * administradora confirma; el revisor y la auditora controlan lo ajeno.
 */

jest.setTimeout(120_000);

const CORREO_DUENO = 'dueno-uj3@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const DOMINIO = 'uj3.test';
const RFC_A = 'UJT240101AB1';
const CORREO_ADMIN = `admin@${DOMINIO}`;
const CORREO_CONTADORA = `contadora@${DOMINIO}`;
const CORREO_REVISOR = `revisor@${DOMINIO}`;
const CORREO_AUDITORA = `auditora@${DOMINIO}`;

let r: Recorrido;
let ds: DataSource;
let A: string;
let tokenLuis: string;
let tokenAna: string;
let tokenRevisor: string;
let tokenAuditora: string;

const http = () => r.http();
const cfdiDeLaEmpresa = (folio: string) => cfdiDeEjemploPara(RFC_A, folio);
const aceptar = async (para: string, nombre: string) =>
  (await r.aceptar(para, nombre)).cookie;

beforeAll(async () => {
  r = await levantarRecorrido({
    prefijo: 'cuadra_test_uj3',
    dominio: DOMINIO,
    rfcs: [RFC_A],
    correoDueno: CORREO_DUENO,
    passwordDueno: PASSWORD_DUENO,
    conDominio: true,
  });
  ({ ds } = r);
}, 60_000);

afterAll(async () => {
  await r?.cerrar();
});

const PERMISOS_DE_SECCION = ['bandeja.ver', 'bitacora.ver'];

interface FilaBandeja {
  movimientoId: string;
  estado: string;
  regla: string | null;
  motivo: string | null;
  mejorPropuesta: {
    conciliacionId: string;
    cfdis: { folio: string }[];
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

interface EventoBitacora {
  entidadId: string | null;
  accion: string;
  usuario: { email: string } | null;
}
async function bitacora(token: string, accion: string) {
  const res = await http()
    .get('/bitacora')
    .query({ accion, limite: 100 })
    .set('Cookie', token)
    .expect(200);
  return (res.body as { datos: EventoBitacora[] }).datos;
}

const estadoDe = (id: string) =>
  filas<{ estado: string }>(ds, `SELECT estado FROM decisiones WHERE id = $1`, [
    id,
  ]).then((f) => f[0].estado);

describe('UJ-3: Pedro controla que el mes sea confiable (FR-70)', () => {
  let confirmada: string;
  let loteId: string;
  let movimientoConfirmado: string;

  it('una empresa con un mes conciliado: se crea como en 7.2 y la administradora confirma lo del mes', async () => {
    const cookieDueno = await r.iniciarDueno();
    A = await r.crearEmpresa(
      cookieDueno,
      'Empresa del control SA de CV',
      RFC_A,
      CORREO_ADMIN,
    );
    tokenAna = await aceptar(CORREO_ADMIN, 'Ana, administradora');
    for (const [email, rol] of [
      [CORREO_CONTADORA, 'contador'],
      [CORREO_REVISOR, 'revisor'],
      [CORREO_AUDITORA, 'auditor'],
    ] as const) {
      await http()
        .post('/usuarios/invitaciones')
        .set('Cookie', tokenAna)
        .send({ email, roles: [rol] })
        .expect(201);
    }
    tokenLuis = await aceptar(CORREO_CONTADORA, 'Marisol, contadora');
    tokenRevisor = await aceptar(CORREO_REVISOR, 'Pedro, revisor');
    tokenAuditora = await aceptar(CORREO_AUDITORA, 'Audrey, auditora');

    // El mes: la contadora sube el estado de cuenta y las facturas.
    const carga = await http()
      .post('/cargas/estado-cuenta/pdf')
      .set('Cookie', tokenLuis)
      .field('banco', 'bbva')
      .attach('archivo', leer(PDF_CUADRA), 'septiembre.pdf')
      .expect(200);
    await http()
      .post(`/cargas/${(carga.body as { cargaId: string }).cargaId}/aceptar`)
      .set('Cookie', tokenLuis)
      .expect(200);
    const cfdi = http().post('/cargas/cfdi').set('Cookie', tokenLuis);
    for (const f of FACTURAS) {
      cfdi.attach('archivos', cfdiDeLaEmpresa(f.folio), `${f.folio}.xml`);
    }
    const subida = await cfdi.expect(202);
    await r.esperarFin(tokenLuis, (subida.body as { id: string }).id);
    await r.app.get(ConciliacionService).conciliar(A);

    // La administradora confirma la regla 1: una confirmación ajena para el revisor.
    const sug = await bandeja(tokenAna, ['sugerencia']);
    expect(sug[0].regla).toBe('referencia_monto_exacto');
    confirmada = sug[0].mejorPropuesta!.conciliacionId;
    movimientoConfirmado = sug[0].movimientoId;
    const lote = await http()
      .post('/conciliaciones/lotes')
      .set('Cookie', tokenAna)
      .send({ ids: [confirmada] })
      .expect(200);
    loteId = (lote.body as { loteId: string }).loteId;
    expect(await estadoDe(confirmada)).toBe('confirmada');
  });

  it('el revisor entra y su menú muestra solo la bandeja y la bitácora', async () => {
    const res = await http()
      .get('/auth/contexto')
      .set('Cookie', tokenRevisor)
      .expect(200);
    const contexto = res.body as { roles: string[]; capacidades: string[] };
    expect(contexto.roles).toEqual(['revisor']);
    // Las secciones del menú son los permisos `*.ver` de la matriz.
    const secciones = contexto.capacidades.filter((c) => c.endsWith('.ver'));
    expect(secciones.sort()).toEqual(PERMISOS_DE_SECCION);
    expect(contexto.capacidades.sort()).toEqual(
      [...permisosDeRoles(['revisor'])].sort(),
    );
  });

  it('su bandeja trae lo que sigue sin resolver, con candidatos y explicación', async () => {
    const pendientes = await bandeja(tokenRevisor, ['sugerencia', 'sin_match']);
    expect(pendientes).toHaveLength(5);
    expect(pendientes.map((f) => f.movimientoId)).not.toContain(
      movimientoConfirmado,
    );
    for (const f of pendientes) expect(f.motivo).toBeTruthy();
    const conPropuesta = pendientes.filter((f) => f.estado === 'sugerencia');
    expect(conPropuesta).toHaveLength(3);
    for (const f of conPropuesta) {
      expect(f.mejorPropuesta!.cfdis.length).toBeGreaterThan(0);
    }
    // El depósito de varias facturas muestra todas sus candidatas.
    const grupo = conPropuesta.find((f) => f.regla === 'suma_grupo');
    expect(grupo!.mejorPropuesta!.cfdis.map((c) => c.folio)).toEqual([
      '5004',
      '5005',
    ]);
    // Lo confirmado sí está, pero en su propio estado.
    const hechas = await bandeja(tokenRevisor, ['conciliado']);
    expect(hechas.map((f) => f.movimientoId)).toContain(movimientoConfirmado);
  });

  it('ante una confirmación ajena no puede reabrirla: 403 y queda un acceso denegado', async () => {
    const antes = await bitacora(tokenRevisor, 'acceso_denegado');

    await http()
      .post(`/conciliaciones/${confirmada}/reabrir`)
      .set('Cookie', tokenRevisor)
      .send({ motivo: 'No me parece' })
      .expect(403);
    await http()
      .post(`/conciliaciones/lotes/${loteId}/reabrir`)
      .set('Cookie', tokenRevisor)
      .send({ motivo: 'No me parece' })
      .expect(403);

    const despues = await bitacora(tokenRevisor, 'acceso_denegado');
    expect(despues.length - antes.length).toBe(2);
    expect(despues.every((e) => e.usuario?.email === CORREO_REVISOR)).toBe(
      true,
    );
    // Nada cambió.
    expect(await estadoDe(confirmada)).toBe('confirmada');
  });

  it('puede comentar la confirmación: el comentario sale en el detalle y en la bitácora y el estado no cambia', async () => {
    const texto = 'Revisada contra el estado de cuenta: correcta.';
    await http()
      .post(`/conciliaciones/${confirmada}/comentarios`)
      .set('Cookie', tokenRevisor)
      .send({ texto })
      .expect(201);

    const detalle = await http()
      .get(`/casos/${movimientoConfirmado}`)
      .set('Cookie', tokenRevisor)
      .expect(200);
    const comentarios = (detalle.body as { comentarios: { texto: string }[] })
      .comentarios;
    expect(comentarios.map((c) => c.texto)).toEqual([texto]);

    const eventos = (await bitacora(tokenRevisor, 'comentar')).filter(
      (e) => e.entidadId === confirmada,
    );
    expect(eventos).toHaveLength(1);
    expect(eventos[0].usuario?.email).toBe(CORREO_REVISOR);

    expect(await estadoDe(confirmada)).toBe('confirmada');
    const [{ estado }] = await filas<{ estado: string }>(
      ds,
      `SELECT estado FROM movimientos WHERE id = $1`,
      [movimientoConfirmado],
    );
    expect(estado).toBe('conciliado');
  });

  it('la auditora ve la bandeja y la bitácora sin ninguna acción disponible', async () => {
    const contexto = (
      await http()
        .get('/auth/contexto')
        .set('Cookie', tokenAuditora)
        .expect(200)
    ).body as { capacidades: string[] };
    expect(contexto.capacidades.sort()).toEqual(PERMISOS_DE_SECCION);

    expect(
      (await bandeja(tokenAuditora, ['sugerencia', 'sin_match'])).length,
    ).toBe(5);
    await bitacora(tokenAuditora, 'comentar');

    const pendiente = (await bandeja(tokenAuditora, ['sugerencia']))[0];
    const acciones = [
      http()
        .post('/conciliaciones/lotes')
        .send({ ids: [pendiente.mejorPropuesta!.conciliacionId] }),
      http()
        .post(`/movimientos/${pendiente.movimientoId}/descartar`)
        .send({ motivo: 'x' }),
      http()
        .post(`/conciliaciones/${confirmada}/comentarios`)
        .send({ texto: 'x' }),
      http()
        .post(`/conciliaciones/${confirmada}/reabrir`)
        .send({ motivo: 'x' }),
      http().post('/cargas/cfdi'),
    ];
    for (const accion of acciones) {
      await accion.set('Cookie', tokenAuditora).expect(403);
    }
    expect(await estadoDe(confirmada)).toBe('confirmada');
  });
});
