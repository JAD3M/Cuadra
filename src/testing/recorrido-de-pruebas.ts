import { getQueueToken } from '@nestjs/bullmq';
import { type INestApplication, Logger, type Type } from '@nestjs/common';
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
import { COLA_SUGERENCIAS } from '../sugerencias/cola-sugerencias';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { RFC_EMPRESA } from '../../scripts/demo/formatos';
import { nombreDeCfdi } from '../../scripts/ejemplos/generar';
import { limpiarLimites } from './limites-de-pruebas';
import { cookieDe } from './sesion-de-pruebas';
import request from './supertest-con-origen';

/**
 * Lo que comparten los recorridos de punta a punta (AD-18, FR-70): la app con
 * Postgres (como cuadra_app, sujeta a RLS) y Redis reales, el correo simulado,
 * el dueño de la plataforma, la empresa que se da de alta por HTTP, la
 * aceptación de invitaciones y la limpieza. Cada recorrido pone sus pasos.
 */

const MODULOS_BASE: Type<unknown>[] = [AuthModule, UsuariosModule];
const MODULOS_DE_DOMINIO: Type<unknown>[] = [
  ContextoEmpresaModule,
  ColasModule,
  CargasModule,
  CompaniesModule,
  BandejaModule,
  BitacoraModule,
  CasosModule,
  ResolucionModule,
  SombraModule,
];
const TABLAS_DE_DOMINIO =
  'cfdi, cargas, movimientos, movimientos_pendientes, decisiones, decision_lineas, evidencia_sombra';

export interface OpcionesDeRecorrido {
  /** Prefijo de Redis y de la cola: propio de cada recorrido. */
  prefijo: string;
  /** Dominio de los correos de las personas del recorrido (`@dominio`). */
  dominio: string;
  /** RFC de las empresas que crea el recorrido. */
  rfcs: string[];
  correoDueno: string;
  passwordDueno: string;
  /** Contraseña con la que entran las personas invitadas. */
  password?: string;
  /** Cargas, bandeja, resolución…: arranca las colas y limpia el dominio. */
  conDominio?: boolean;
}

export interface Recorrido {
  app: INestApplication<App>;
  /** Conexión del dueño de la base: prepara y verifica sin RLS. */
  ds: DataSource;
  correo: CorreoSimulado;
  http(): ReturnType<typeof request>;
  /** El dueño inicia sesión; devuelve su cookie. */
  iniciarDueno(): Promise<string>;
  /** El dueño da de alta la empresa e invita a su administrador; devuelve el id. */
  crearEmpresa(
    cookieDueno: string,
    razonSocial: string,
    rfc: string,
    correoAdmin: string,
  ): Promise<string>;
  /** Token del último correo enviado a `para`, del enlace del correo simulado. */
  tokenDe(para: string): string;
  aceptar(
    para: string,
    nombre: string,
  ): Promise<{ cookie: string; cuentaNueva: boolean; companyId: string }>;
  /** Sondea la carga hasta que termina, o truena a los 20 s. */
  esperarFin(token: string, id: string): Promise<EstadoDeCarga>;
  /** Limpia lo que dejó el recorrido, comprueba que no queda nada y cierra. */
  cerrar(): Promise<void>;
}

export async function levantarRecorrido(
  o: OpcionesDeRecorrido,
): Promise<Recorrido> {
  const password = o.password ?? 'contraseña-nueva-segura';
  // Prefijo propio: si no, el worker de la api en Docker tomaría estos jobs.
  process.env.COLA_PREFIJO = o.prefijo;
  if (o.conDominio) {
    process.env.COLA_INTENTOS = '5';
    process.env.COLA_ESPERA_MS = '20';
    delete process.env.ANTHROPIC_API_KEY;
    process.env.LLM_HABILITADO = 'false';
  }

  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  const ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
  if (o.conDominio) await ds.query(`TRUNCATE ${TABLAS_DE_DOMINIO} CASCADE`);
  // No hay ruta para sembrar al dueño de la plataforma.
  const hash = await new PasswordHasher().hashear(o.passwordDueno);
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ($1, $2) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = true`,
    [o.correoDueno, hash],
  );

  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: urlAppDePruebas(),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      ...(o.conDominio ? MODULOS_DE_DOMINIO : []),
      ...MODULOS_BASE,
    ],
  }).compile();
  if (o.conDominio) {
    // Jobs de una corrida anterior apuntan a cargas que ya se truncaron.
    await modulo
      .get<Queue>(getQueueToken(COLA_CARGAS))
      .obliterate({ force: true });
    await modulo
      .get<Queue>(getQueueToken(COLA_SUGERENCIAS))
      .obliterate({ force: true });
  }
  const app = modulo.createNestApplication<INestApplication<App>>();
  configurarApp(app);
  await app.listen(0);
  const correo: CorreoSimulado = app.get(ProveedorCorreo, { strict: false });
  await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), o.prefijo);
  jest.spyOn(Logger.prototype, 'error').mockImplementation();

  const http = () => request(app.getHttpServer());

  const tokenDe = (para: string): string => {
    const mensaje = correo.ultimoPara(para);
    const m = /\/invitacion\/([A-Za-z0-9_-]+)/.exec(mensaje?.texto ?? '');
    if (!m) throw new Error(`No hubo correo con enlace para ${para}`);
    return m[1];
  };

  return {
    app,
    ds,
    correo,
    http,
    tokenDe,
    async iniciarDueno() {
      const login = await http()
        .post('/plataforma/auth/login')
        .send({ email: o.correoDueno, password: o.passwordDueno })
        .expect(200);
      return cookieDe(login);
    },
    async crearEmpresa(cookieDueno, razonSocial, rfc, correoAdmin) {
      const creada = await http()
        .post('/plataforma/empresas')
        .set('Cookie', cookieDueno)
        .send({ razonSocial, rfc })
        .expect(201);
      const id = (creada.body as { id: string }).id;
      await http()
        .post(`/plataforma/empresas/${id}/invitaciones`)
        .set('Cookie', cookieDueno)
        .send({ email: correoAdmin })
        .expect(201);
      return id;
    },
    async aceptar(para, nombre) {
      const res = await http()
        .post(`/auth/invitaciones/${tokenDe(para)}/aceptar`)
        .send({ nombre, password })
        .expect(200);
      const cuerpo = res.body as { cuentaNueva: boolean; companyId: string };
      return { cookie: cookieDe(res), ...cuerpo };
    },
    async esperarFin(token, id) {
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
        if (Date.now() > limite) {
          throw new Error(`La carga ${id} sigue en curso`);
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    },
    async cerrar() {
      jest.restoreAllMocks();
      await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), o.prefijo);
      await app.close();
      if (!ds.isInitialized) return;
      // Las bitácoras son de solo agregar para cuadra_app; el dueño limpia.
      if (o.conDominio) await ds.query(`TRUNCATE ${TABLAS_DE_DOMINIO} CASCADE`);
      const empresas = `(SELECT id FROM companies WHERE rfc = ANY($1))`;
      const rfcs = [o.rfcs];
      const personas = `(SELECT id FROM users WHERE email LIKE '%@${o.dominio}')`;
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
      await ds.query(`DELETE FROM users WHERE email LIKE '%@${o.dominio}'`);
      await ds.query(`DELETE FROM bitacora_plataforma`);
      await ds.query(`DELETE FROM companies WHERE rfc = ANY($1)`, rfcs);
      await ds.query(`DELETE FROM plataforma_usuarios WHERE correo = $1`, [
        o.correoDueno,
      ]);
      // No deja datos entre ejecuciones.
      const [{ n }] = await filas<{ n: string }>(
        ds,
        `SELECT (SELECT count(*) FROM companies WHERE rfc = ANY($1))
              + (SELECT count(*) FROM users WHERE email LIKE '%@${o.dominio}') AS n`,
        rfcs,
      );
      expect(Number(n)).toBe(0);
      if (o.conDominio) {
        const [{ restos }] = await filas<{ restos: string }>(
          ds,
          `SELECT (SELECT count(*) FROM movimientos) + (SELECT count(*) FROM cfdi)
                + (SELECT count(*) FROM cargas) + (SELECT count(*) FROM decisiones) AS restos`,
        );
        expect(Number(restos)).toBe(0);
      }
      await ds.destroy();
    },
  };
}

const RAIZ = join(__dirname, '..', '..');

/** Lee un archivo del repositorio (por ejemplo, de `ejemplos/`). */
export const leerEjemplo = (ruta: string): Buffer =>
  readFileSync(join(RAIZ, ruta));

/**
 * Los CFDI del juego de ejemplo salen a nombre del RFC de la Ferretería del
 * seed y el motor solo concilia los emitidos por la empresa de la sesión. Un
 * recorrido que crea su propia empresa reescribe el emisor en memoria; los
 * archivos del repositorio no cambian.
 */
export const cfdiDeEjemploPara = (rfc: string, folio: string): Buffer =>
  Buffer.from(
    leerEjemplo(nombreDeCfdi(folio))
      .toString('utf8')
      .replaceAll(`Rfc="${RFC_EMPRESA.fdb}"`, `Rfc="${rfc}"`),
  );
