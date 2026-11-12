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
import {
  nombreDeCfdi,
  PDF_CUADRA,
  PDF_NO_CUADRA,
} from '../../scripts/ejemplos/generar';
import { RFC_EMPRESA } from '../../scripts/demo/formatos';
import { FACTURAS, MOVIMIENTOS } from '../../scripts/ejemplos/juego';

const PREFIJO_LIMITE = 'cuadra_test_uj1';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;
process.env.COLA_INTENTOS = '5';
process.env.COLA_ESPERA_MS = '20';

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
const PASSWORD = 'contraseña-nueva-segura';
const DOMINIO = 'uj1.test';
const RFC_A = 'UJA240101AB1';
const RFC_B = 'UJB240202BC2';
const CORREO_ADMIN = `admin@${DOMINIO}`;
const CORREO_CONTADORA = `contadora@${DOMINIO}`;
const CORREO_ADMIN_B = `admin-b@${DOMINIO}`;

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
let B: string;
let tokenLuis: string;
let tokenAna: string;
let tokenOtra: string;

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
    const login = await http()
      .post('/plataforma/auth/login')
      .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
      .expect(200);
    const cookieDueno = cookieDe(login);

    const crear = async (razonSocial: string, rfc: string, admin: string) => {
      const creada = await http()
        .post('/plataforma/empresas')
        .set('Cookie', cookieDueno)
        .send({ razonSocial, rfc })
        .expect(201);
      const id = (creada.body as { id: string }).id;
      await http()
        .post(`/plataforma/empresas/${id}/invitaciones`)
        .set('Cookie', cookieDueno)
        .send({ email: admin })
        .expect(201);
      return id;
    };
    A = await crear('Ferretería del recorrido SA de CV', RFC_A, CORREO_ADMIN);
    B = await crear(
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
    const fin = await esperarFin(tokenLuis, (subida.body as { id: string }).id);
    expect(fin).toMatchObject({ estado: 'procesada', registrosOk: 9 });
    // La factura en dólares queda marcada «moneda no soportada».
    expect(fin.resultados).toContainEqual(
      expect.objectContaining({
        archivo: '5009.xml',
        moneda: 'USD',
        monedaNoSoportada: true,
      }),
    );

    await app.get(ConciliacionService).conciliar(A);

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
