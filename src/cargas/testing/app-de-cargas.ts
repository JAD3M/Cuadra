// src/cargas/testing/app-de-cargas.ts
import { getQueueToken } from '@nestjs/bullmq';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../../auth/auth.module';
import type { JwtPayload } from '../../auth/tipos';
import { ColasModule } from '../../colas/colas.module';
import { CompaniesModule } from '../../companies/companies.module';
import { validateEnv } from '../../config/env.validation';
import { ContextoEmpresaModule } from '../../database/contexto-empresa.module';
import { opcionesDataSource } from '../../database/data-source';
import { ENTIDADES } from '../../database/entidades';
import { SnakeNamingStrategy } from '../../database/naming.strategy';
import { sembrar } from '../../database/seeds/seed';
import {
  crearBaseDePruebas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../../database/testing/base-de-pruebas';
import { CargasModule } from '../cargas.module';
import { COLA_CARGAS } from '../cola-cargas';
import type { EstadoDeCarga } from '../estado-de-carga';

/** Personas y empresas del seed que usan los specs de cargas. */
export const ANA = 'ana.reyes@fdb.mx'; // admin en Ferretería
export const LUIS = 'luis.mendoza@fdb.mx'; // contador en Ferretería
export const CARMEN = 'carmen.olvera@cuautla.mx'; // admin en Transportes
export const JORGE = 'jorge.tapia@despacho.mx'; // revisor en Transportes
export const FERRETERIA = 'FDB190215QK4';
export const TRANSPORTES = 'TCU170830R52';

const TERMINALES = new Set(['procesada', 'con_errores', 'fallida']);

/**
 * La app de cargas de punta a punta para los specs de integración: HTTP,
 * guards globales, transacción de empresa como cuadra_app (RLS activo),
 * Postgres real y la cola en el Redis del compose, con el worker en el mismo
 * proceso. Más una conexión del dueño (`ds`) para preparar y verificar sin
 * RLS.
 */
export interface AppDeCargas {
  app: INestApplication<App>;
  ds: DataSource;
  empresa(rfc: string): string;
  persona(email: string): string;
  token(email: string, rfc: string): Promise<string>;
  consultar(token: string, id: string): Promise<EstadoDeCarga>;
  /** Poll al GET hasta que la carga termine, o truena a los 20 s. */
  esperarFin(token: string, id: string): Promise<EstadoDeCarga>;
  cerrar(): Promise<void>;
}

export async function levantarAppDeCargas(): Promise<AppDeCargas> {
  // Esperas cortas para que los reintentos no alarguen la corrida, y un
  // prefijo propio: si no, el worker de la api en Docker tomaría estos jobs
  // y los buscaría en la base de desarrollo. Jest da a cada archivo su copia
  // de process.env.
  process.env.COLA_INTENTOS = '5';
  process.env.COLA_ESPERA_MS = '20';
  process.env.COLA_PREFIJO = 'cuadra_test';

  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  const ds = await new DataSource({
    ...opcionesDataSource,
    url,
  }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
  // cuadra_test sobrevive entre corridas: sin esto, los UUID de la corrida
  // anterior chocarían. Los otros specs recrean sus cargas en su beforeAll.
  // CASCADE alcanza a carga_archivos y movimientos.
  await ds.query('TRUNCATE cfdi, cargas CASCADE');

  const empresas = new Map<string, string>();
  for (const rfc of [FERRETERIA, TRANSPORTES]) {
    const { id } = await una<{ id: string }>(
      ds,
      'SELECT id FROM companies WHERE rfc = $1',
      [rfc],
    );
    empresas.set(rfc, id);
  }
  const personas = new Map<string, string>();
  for (const email of [ANA, LUIS, CARMEN, JORGE]) {
    const { id } = await una<{ id: string }>(
      ds,
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    personas.set(email, id);
  }

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
    ],
  }).compile();

  // Jobs de una corrida anterior apuntan a cargas que ya se truncaron.
  await modulo
    .get<Queue>(getQueueToken(COLA_CARGAS))
    .obliterate({ force: true });

  const app = modulo.createNestApplication<INestApplication<App>>();
  // Igual que main.ts.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0);
  const jwt = new JwtService({
    secret: app.get(ConfigService).getOrThrow<string>('JWT_SECRET'),
  });

  /**
   * Un typo en una llave daría `undefined`, y un token con `sub: undefined`
   * lo rechaza el guard con 401: el test pasaría por la razón equivocada.
   */
  const de = (mapa: Map<string, string>, llave: string): string => {
    const valor = mapa.get(llave);
    if (valor === undefined) throw new Error(`Falta "${llave}" en el seed`);
    return valor;
  };

  const consultar = async (token: string, id: string) => {
    const res = await request(app.getHttpServer())
      .get(`/cargas/${id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    return res.body as EstadoDeCarga;
  };

  return {
    app,
    ds,
    empresa: (rfc) => de(empresas, rfc),
    persona: (email) => de(personas, email),
    // Firmados a mano, sin pasar por el login (eso lo prueba CU-03). Misma
    // duración que D-09.
    token: (email, rfc) => {
      const payload: JwtPayload = {
        sub: de(personas, email),
        scope: 'sesion',
        companyId: de(empresas, rfc),
      };
      return jwt.signAsync(payload, { expiresIn: '15m' });
    },
    consultar,
    esperarFin: async (token, id) => {
      const limite = Date.now() + 20_000;
      for (;;) {
        const carga = await consultar(token, id);
        if (TERMINALES.has(carga.estado)) return carga;
        if (Date.now() > limite) {
          throw new Error(`La carga ${id} sigue en '${carga.estado}'`);
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    },
    cerrar: async () => {
      await app.close();
      if (ds.isInitialized) {
        // También al salir: un CFDI en 'parcialidades' detiene el down de
        // CargaDeArchivos, y esquema.spec revierte todas las migraciones.
        await ds.query('TRUNCATE cfdi, cargas CASCADE');
        await ds.destroy();
      }
    },
  };
}
