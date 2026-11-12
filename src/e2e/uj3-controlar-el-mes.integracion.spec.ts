import { type INestApplication, Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { readFileSync } from 'fs';
import type { Redis } from 'ioredis';
import { join } from 'path';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { PasswordHasher } from '../auth/password';
import { permisosDeRoles } from '../auth/permisos/matriz';
import { BandejaModule } from '../bandeja/bandeja.module';
import { BitacoraModule } from '../bitacora/bitacora.module';
import { CargasModule } from '../cargas/cargas.module';
import { COLA_CARGAS } from '../cargas/cola-cargas';
import type { EstadoDeCarga } from '../cargas/estado-de-carga';
import { CasosModule } from '../casos/casos.module';
import { ColasModule } from '../colas/colas.module';
import { CompaniesModule } from '../companies/companies.module';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { validateEnv } from '../config/env.validation';
import { configurarApp } from '../configurar-app';
import { CorreoSimulado } from '../correo/correo-simulado';
import { ProveedorCorreo } from '../correo/proveedor-correo';
import { ContextoEmpresaModule } from '../database/contexto-empresa.module';
import { opcionesDataSource } from '../database/data-source';
import { ENTIDADES } from '../database/entidades';
import { SnakeNamingStrategy } from '../database/naming.strategy';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { ResolucionModule } from '../resolucion/resolucion.module';
import { SombraModule } from '../sombra/sombra.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { COLA_SUGERENCIAS } from '../sugerencias/cola-sugerencias';
import { limpiarLimites } from '../testing/limites-de-pruebas';
import { cookieDe } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';
import { nombreDeCfdi, PDF_CUADRA } from '../../scripts/ejemplos/generar';
import { RFC_EMPRESA } from '../../scripts/demo/formatos';
import { FACTURAS } from '../../scripts/ejemplos/juego';

const PREFIJO_LIMITE = 'cuadra_test_uj3';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;
process.env.COLA_INTENTOS = '5';
process.env.COLA_ESPERA_MS = '20';

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
const PASSWORD = 'contraseña-nueva-segura';
const DOMINIO = 'uj3.test';
const RFC_A = 'UJT240101AB1';
const RFC_B = 'UJU240202BC2';
const CORREO_ADMIN = `admin@${DOMINIO}`;
const CORREO_CONTADORA = `contadora@${DOMINIO}`;
const CORREO_REVISOR = `revisor@${DOMINIO}`;
const CORREO_AUDITORA = `auditora@${DOMINIO}`;

const RAIZ = join(__dirname, '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta));

/**
 * Los CFDI del juego salen a nombre del RFC de la Ferretería del seed y el
 * motor solo concilia los emitidos por la empresa de la sesión. Esta empresa se
 * crea con su propio RFC, así que el emisor se reescribe en memoria; los
 * archivos del repositorio no cambian.
 */
const cfdiDeLaEmpresa = (folio: string) =>
  Buffer.from(
    leer(nombreDeCfdi(folio))
      .toString('utf8')
      .replaceAll(`Rfc="${RFC_EMPRESA.fdb}"`, `Rfc="${RFC_A}"`),
  );

let app: INestApplication<App>;
let ds: DataSource;
let correo: CorreoSimulado;
let A: string;
let tokenLuis: string;
let tokenAna: string;
let tokenRevisor: string;
let tokenAuditora: string;

const http = () => request(app.getHttpServer());

const TABLAS_DE_DOMINIO =
  'cfdi, cargas, movimientos, movimientos_pendientes, decisiones, decision_lineas, evidencia_sombra';

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
  await ds.query(`TRUNCATE ${TABLAS_DE_DOMINIO} CASCADE`);
  // No hay ruta para sembrar al dueño de la plataforma.
  const hash = await new PasswordHasher().hashear(PASSWORD_DUENO);
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ($1, $2) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = true`,
    [CORREO_DUENO, hash],
  );

  delete process.env.ANTHROPIC_API_KEY;
  process.env.LLM_HABILITADO = 'false';
  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: urlAppDePruebas(),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      ContextoEmpresaModule,
      ColasModule,
      AuthModule,
      CargasModule,
      CompaniesModule,
      BandejaModule,
      BitacoraModule,
      CasosModule,
      ResolucionModule,
      SombraModule,
      UsuariosModule,
    ],
  }).compile();
  // Jobs de una corrida anterior apuntan a cargas que ya se truncaron.
  await modulo
    .get<Queue>(getQueueToken(COLA_CARGAS))
    .obliterate({ force: true });
  await modulo
    .get<Queue>(getQueueToken(COLA_SUGERENCIAS))
    .obliterate({ force: true });
  app = modulo.createNestApplication();
  configurarApp(app);
  await app.listen(0);
  correo = app.get(ProveedorCorreo, { strict: false });
  await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
}, 60_000);

afterAll(async () => {
  jest.restoreAllMocks();
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    // Las bitácoras son de solo agregar para cuadra_app; el dueño limpia.
    await ds.query(`TRUNCATE ${TABLAS_DE_DOMINIO} CASCADE`);
    const empresas = `(SELECT id FROM companies WHERE rfc = ANY($1))`;
    const rfcs = [[RFC_A, RFC_B]];
    const personas = `(SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`;
    await ds.query(`DELETE FROM sesiones WHERE user_id IN ${personas}`);
    await ds.query(
      `DELETE FROM sesiones WHERE plataforma_usuario_id IS NOT NULL`,
    );
    await ds.query(
      `DELETE FROM user_company_roles WHERE company_id IN ${empresas} OR user_id IN ${personas}`,
      rfcs,
    );
    await ds.query(
      `DELETE FROM invitaciones WHERE company_id IN ${empresas}`,
      rfcs,
    );
    await ds.query(
      `DELETE FROM bitacora WHERE company_id IN ${empresas}`,
      rfcs,
    );
    await ds.query(`DELETE FROM users WHERE email LIKE '%@${DOMINIO}'`);
    await ds.query(`DELETE FROM bitacora_plataforma`);
    await ds.query(`DELETE FROM companies WHERE rfc = ANY($1)`, rfcs);
    await ds.query(`DELETE FROM plataforma_usuarios WHERE correo = $1`, [
      CORREO_DUENO,
    ]);
    // No deja datos entre ejecuciones.
    const [{ n }] = await filas<{ n: string }>(
      ds,
      `SELECT (SELECT count(*) FROM companies WHERE rfc = ANY($1))
            + (SELECT count(*) FROM users WHERE email LIKE '%@${DOMINIO}')
            + (SELECT count(*) FROM movimientos) + (SELECT count(*) FROM cfdi)
            + (SELECT count(*) FROM cargas) + (SELECT count(*) FROM decisiones) AS n`,
      rfcs,
    );
    expect(Number(n)).toBe(0);
    await ds.destroy();
  }
});

/** Token del último correo enviado a `para`, leído del enlace del correo simulado. */
function tokenDe(para: string): string {
  const mensaje = correo.ultimoPara(para);
  const m = /\/invitacion\/([A-Za-z0-9_-]+)/.exec(mensaje?.texto ?? '');
  if (!m) throw new Error(`No hubo correo con enlace para ${para}`);
  return m[1];
}

async function aceptar(para: string, nombre: string): Promise<string> {
  const res = await http()
    .post(`/auth/invitaciones/${tokenDe(para)}/aceptar`)
    .send({ nombre, password: PASSWORD })
    .expect(200);
  return cookieDe(res);
}

/** Sondea la carga hasta que termina, o truena a los 20 s. */
async function esperarFin(token: string, id: string): Promise<EstadoDeCarga> {
  const limite = Date.now() + 20_000;
  for (;;) {
    const res = await http()
      .get(`/cargas/${id}`)
      .set('Cookie', token)
      .expect(200);
    const carga = res.body as EstadoDeCarga;
    if (['procesada', 'con_errores', 'fallida'].includes(carga.estado)) {
      return carga;
    }
    if (Date.now() > limite) throw new Error(`La carga ${id} sigue en curso`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

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
    const login = await http()
      .post('/plataforma/auth/login')
      .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
      .expect(200);
    const creada = await http()
      .post('/plataforma/empresas')
      .set('Cookie', cookieDe(login))
      .send({ razonSocial: 'Empresa del control SA de CV', rfc: RFC_A })
      .expect(201);
    A = (creada.body as { id: string }).id;
    await http()
      .post(`/plataforma/empresas/${A}/invitaciones`)
      .set('Cookie', cookieDe(login))
      .send({ email: CORREO_ADMIN })
      .expect(201);
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
    await esperarFin(tokenLuis, (subida.body as { id: string }).id);
    await app.get(ConciliacionService).conciliar(A);

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
