import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsuarioActual } from '../common/decorators/decoradores';
import type { UsuarioAutenticado } from '../auth/tipos';
import { abrirSesion } from '../testing/sesion-de-pruebas';
import { validateEnv } from '../config/env.validation';
import { ContextoEmpresa } from './contexto-empresa';
import { ContextoEmpresaModule } from './contexto-empresa.module';
import { opcionesDataSource } from './data-source';
import { ENTIDADES } from './entidades';
import { SnakeNamingStrategy } from './naming.strategy';
import { sembrar } from './seeds/seed';
import {
  crearBaseDePruebas,
  urlDePruebas,
  una,
  urlAppDePruebas,
} from './testing/base-de-pruebas';

const CARMEN = 'carmen.olvera@cuautla.mx'; // admin en Transportes
const JORGE = 'jorge.tapia@despacho.mx'; // contador en Ferretería, revisor en Transportes
const FERRETERIA = 'FDB190215QK4';
const TRANSPORTES = 'TCU170830R52';

@Controller('prueba')
class ControlCargas {
  constructor(private readonly contexto: ContextoEmpresa) {}
  @Get('cargas/:id')
  async getCarga(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    if (usuario.scope !== 'sesion') {
      throw new Error('SesionCookieGuard dejó pasar una sesión sin empresa');
    }
    // El companyId sale solo de la sesión. Ajena o inexistente, la respuesta es
    // la misma: no se confirma que exista lo que no es tuyo.
    // El manager de la transacción de la petición: cuadra_app con la
    // empresa de la sesión fijada, así que RLS filtra aunque falte el WHERE.
    const carga = await una<{ id: string } | undefined>(
      this.contexto.manager(),
      'SELECT id FROM cargas WHERE id = $1 AND company_id = $2',
      [id, usuario.companyId],
    );
    if (!carga) throw new NotFoundException();
    return carga;
  }
}

let app: INestApplication<App>;
/** Conexión del dueño: abre las sesiones de los tests directo en `sesiones`. */
let preparacion: DataSource;

/** Por RFC. */
const empresas = new Map<string, string>();
/** Por email. */
const personas = new Map<string, string>();
/** Una carga por empresa, por RFC. */
const cargas = new Map<string, string>();

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  // Conexión de preparación: migra, siembra y queda abierta solo para abrir
  // sesiones. Los tests hablan con la app por HTTP.
  preparacion = await new DataSource({
    ...opcionesDataSource,
    url,
  }).initialize();
  try {
    await preparacion.runMigrations();
    await sembrar(preparacion);

    for (const rfc of [FERRETERIA, TRANSPORTES]) {
      const { id: companyId } = await una<{ id: string }>(
        preparacion,
        'SELECT id FROM companies WHERE rfc = $1',
        [rfc],
      );
      empresas.set(rfc, companyId);

      // cuadra_test sobrevive entre corridas: ON CONFLICT lo hace idempotente.
      // DO UPDATE y no DO NOTHING, porque DO NOTHING no devuelve la fila.
      const { id: cargaId } = await una<{ id: string }>(
        preparacion,
        `INSERT INTO cargas (company_id, tipo, nombre_archivo, hash_archivo)
         VALUES ($1, 'cfdi', $2, $3)
         ON CONFLICT (company_id, hash_archivo) DO UPDATE
           SET updated_at = now()
         RETURNING id`,
        [
          companyId,
          `aislamiento-${rfc}.xml`,
          createHash('sha256').update(`aislamiento-${rfc}`).digest('hex'),
        ],
      );
      cargas.set(rfc, cargaId);
    }

    for (const email of [JORGE, CARMEN]) {
      const { id } = await una<{ id: string }>(
        preparacion,
        'SELECT id FROM users WHERE email = $1',
        [email],
      );
      personas.set(email, id);
    }
  } catch (error) {
    await preparacion.destroy();
    throw error;
  }

  // AuthModule trae los guards globales (APP_GUARD): aplican también a
  // ControlCargas aunque se declare aquí y no dentro de AuthModule.
  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        // Como en producción: cuadra_app, sujeto a RLS.
        url: urlAppDePruebas(),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      ContextoEmpresaModule,
      AuthModule,
    ],
    controllers: [ControlCargas],
  }).compile();

  app = modulo.createNestApplication();
  // Igual que main.ts: el caso 3 tiene que ver lo mismo que producción.
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0);
}, 60_000);

afterAll(async () => {
  await app?.close();
  if (preparacion?.isInitialized) await preparacion.destroy();
});

/**
 * Un typo en una llave daría `undefined`, y una sesión sin usuario no se
 * puede abrir: el caso 4 pasaría por la razón equivocada. Mejor
 * que truene aquí con un mensaje claro.
 */
function de(mapa: Map<string, string>, llave: string): string {
  const valor = mapa.get(llave);
  if (valor === undefined) throw new Error(`Falta "${llave}" en el beforeAll`);
  return valor;
}

/**
 * Sesiones abiertas directo en `sesiones`, sin pasar por el login: la regla
 * de "solo hay sesión si hay membresía" ya la prueba CU-03. Aquí interesa la
 * capa de después. Devuelven el encabezado `Cookie`.
 */
function tokenSesion(email: string, rfc: string): Promise<string> {
  return abrirSesion(preparacion, de(personas, email), de(empresas, rfc));
}

/** Sesión abierta sin empresa elegida. */
function tokenSeleccion(email: string): Promise<string> {
  return abrirSesion(preparacion, de(personas, email), null);
}

const http = () => request(app.getHttpServer());

describe('Aislamiento entre empresas (CU-04)', () => {
  it('una empresa no ve la carga de otra: 404 idéntico a no existir, no 403', async () => {
    const token = await tokenSesion(CARMEN, TRANSPORTES);

    const ajena = await http()
      .get(`/prueba/cargas/${de(cargas, FERRETERIA)}`)
      .set('Cookie', token)
      .expect(404);
    const inexistente = await http()
      .get(`/prueba/cargas/${randomUUID()}`)
      .set('Cookie', token)
      .expect(404);

    expect(ajena.body).toEqual(inexistente.body);
  });

  it('manda el companyId de la sesión, no la persona: Jorge con Ferretería no ve Cuautla', async () => {
    await http()
      .get(`/prueba/cargas/${de(cargas, TRANSPORTES)}`)
      .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
      .expect(404);
  });

  it('un companyId en la query se ignora: gana el de la sesión', async () => {
    await http()
      .get(`/prueba/cargas/${de(cargas, TRANSPORTES)}`)
      .query({ companyId: de(empresas, TRANSPORTES) })
      .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
      .expect(404);
  });

  it('la sesión sin empresa no entra a un endpoint de dominio: 401', async () => {
    await http()
      .get(`/prueba/cargas/${de(cargas, TRANSPORTES)}`)
      .set('Cookie', await tokenSeleccion(JORGE))
      .expect(401);
  });

  // Control positivo: sin él, un aislamiento que bloquea todo (p. ej. RLS sin
  // la empresa en contexto) dejaría los cuatro casos de arriba en verde.
  it('con la sesión de su empresa sí la ve: 200', async () => {
    const res = await http()
      .get(`/prueba/cargas/${de(cargas, TRANSPORTES)}`)
      .set('Cookie', await tokenSesion(JORGE, TRANSPORTES))
      .expect(200);

    expect(res.body).toEqual({ id: de(cargas, TRANSPORTES) });
  });
});
