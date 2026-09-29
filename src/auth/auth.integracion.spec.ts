import {
  Controller,
  Get,
  type INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { opcionesDataSource } from '../database/data-source';
import { ENTIDADES } from '../database/entidades';
import { SnakeNamingStrategy } from '../database/naming.strategy';
import { PASSWORD_SEMILLA, sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { AuthModule } from './auth.module';
import { Roles, Scope } from '../common/decorators/decoradores';
import { TransaccionEmpresa } from '../database/transaccion-empresa';

/**
 * CU-03 de punta a punta contra Postgres real y el seed: guards globales,
 * los dos tokens de D-09 y los roles leídos de la base en cada request.
 */

/** Endpoints de dominio de mentira: aún no existe ninguno real. */
@Controller('prueba')
class ControladorDeDominio {
  @Get('sesion')
  sesion() {
    return { ok: true };
  }

  @Get('admin')
  @Roles('admin')
  admin() {
    return { ok: true };
  }

  @Get('contador-o-revisor')
  @Roles('contador', 'revisor')
  contadorORevisor() {
    return { ok: true };
  }

  @Get('seleccion')
  @Scope('seleccion')
  seleccion() {
    return { ok: true };
  }
}

const ANA = 'ana.reyes@fdb.mx'; // admin en Ferretería
const JORGE = 'jorge.tapia@despacho.mx'; // contador en Ferretería, revisor en Transportes
const FERRETERIA = 'FDB190215QK4';
const TRANSPORTES = 'TCU170830R52';

let app: INestApplication<App>;
/**
 * Dueño del esquema, para preparar datos (revocar un rol). La app corre como
 * cuadra_app, que no tiene DELETE en ninguna tabla.
 */
let ds: DataSource;
let jwt: JwtService;
const empresas = new Map<string, string>();

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({
    ...opcionesDataSource,
    url,
  }).initialize();
  await ds.runMigrations();
  await sembrar(ds);

  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        // Como en producción: la app corre como cuadra_app, no como el dueño.
        url: urlAppDePruebas(),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      AuthModule,
    ],
    controllers: [ControladorDeDominio],
  }).compile();

  app = modulo.createNestApplication();
  app.useGlobalPipes(
    // Igual que main.ts: sin transform, el @Transform del DTO no llega al handler.
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Escuchando de una vez: si no, supertest abre y cierra el servidor en
  // cada petición y las anidadas (pedir un token dentro de otra) chocan.
  await app.listen(0);

  jwt = new JwtService({
    secret: app.get(ConfigService).getOrThrow<string>('JWT_SECRET'),
  });
  for (const rfc of [FERRETERIA, TRANSPORTES]) {
    const { id } = await una<{ id: string }>(
      ds,
      'SELECT id FROM companies WHERE rfc = $1',
      [rfc],
    );
    empresas.set(rfc, id);
  }
}, 60_000);

afterAll(async () => {
  await app?.close();
  if (ds?.isInitialized) await ds.destroy();
});

const http = () => request(app.getHttpServer());

async function tokenSeleccion(email: string): Promise<string> {
  const res = await http()
    .post('/auth/login')
    .send({ email, password: PASSWORD_SEMILLA })
    .expect(200);
  return (res.body as { token: string }).token;
}

async function tokenSesion(email: string, rfc: string): Promise<string> {
  const res = await http()
    .post(`/auth/empresa/${empresas.get(rfc)}`)
    .auth(await tokenSeleccion(email), { type: 'bearer' })
    .expect(200);
  return (res.body as { token: string }).token;
}

describe('POST /auth/login', () => {
  it('devuelve token de selección y empresas sin duplicar, ordenadas', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: PASSWORD_SEMILLA })
      .expect(200);

    const { token, ...resto } = res.body as { token: unknown };
    expect(typeof token).toBe('string');
    expect(resto).toEqual({
      empresas: [
        {
          id: empresas.get(FERRETERIA),
          razonSocial: 'Ferreteria del Bajio SA de CV',
        },
        {
          id: empresas.get(TRANSPORTES),
          razonSocial: 'Transportes Cuautla SA de CV',
        },
      ],
    });
  });

  it('acepta el email en mayúsculas y con espacios alrededor', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: '  ANA.REYES@FDB.MX  ', password: PASSWORD_SEMILLA })
      .expect(200);

    expect((res.body as { empresas: unknown[] }).empresas).toHaveLength(1);
  });

  it('contraseña mala y email inexistente responden igual', async () => {
    const mala = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: 'incorrecta' })
      .expect(401);
    const inexistente = await http()
      .post('/auth/login')
      .send({ email: 'nadie@ejemplo.mx', password: 'incorrecta' })
      .expect(401);

    expect(mala.body).toEqual(inexistente.body);
  });
});

describe('GET /auth/empresas', () => {
  it('devuelve la misma lista que el login', async () => {
    const login = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: PASSWORD_SEMILLA })
      .expect(200);
    const { token, empresas: delLogin } = login.body as {
      token: string;
      empresas: unknown[];
    };

    const res = await http()
      .get('/auth/empresas')
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(res.body).toEqual(delLogin);
  });

  it('rechaza un token de sesión', async () => {
    await http()
      .get('/auth/empresas')
      .auth(await tokenSesion(JORGE, FERRETERIA), { type: 'bearer' })
      .expect(401);
  });
});

describe('POST /auth/empresa/:id', () => {
  it('canjea por un token de sesión cuando el usuario es miembro', async () => {
    const token = await tokenSesion(JORGE, TRANSPORTES);
    expect(jwt.decode(token)).toMatchObject({
      scope: 'sesion',
      companyId: empresas.get(TRANSPORTES),
    });
  });

  it('da 403 con una empresa que no es suya', async () => {
    await http()
      .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
      .auth(await tokenSeleccion(ANA), { type: 'bearer' })
      .expect(403);
  });

  it('da 400 si el id no es un UUID', async () => {
    await http()
      .post('/auth/empresa/no-es-uuid')
      .auth(await tokenSeleccion(ANA), { type: 'bearer' })
      .expect(400);
  });

  it('rechaza un token de sesión', async () => {
    await http()
      .post(`/auth/empresa/${empresas.get(FERRETERIA)}`)
      .auth(await tokenSesion(ANA, FERRETERIA), { type: 'bearer' })
      .expect(401);
  });

  it('rechaza sin token', async () => {
    await http()
      .post(`/auth/empresa/${empresas.get(FERRETERIA)}`)
      .expect(401);
  });
});

describe('JwtAuthGuard', () => {
  it('un endpoint de dominio rechaza el token de selección', async () => {
    await http()
      .get('/prueba/sesion')
      .auth(await tokenSeleccion(ANA), { type: 'bearer' })
      .expect(401);
  });

  it('un endpoint @Scope("seleccion") lo acepta', async () => {
    await http()
      .get('/prueba/seleccion')
      .auth(await tokenSeleccion(ANA), { type: 'bearer' })
      .expect(200);
  });

  it('rechaza un token firmado sin exp, aunque la firma sea válida', async () => {
    const eterno = await jwt.signAsync({
      sub: 'cualquiera',
      scope: 'sesion',
      companyId: empresas.get(FERRETERIA),
    });
    expect(jwt.decode(eterno)).not.toHaveProperty('exp');

    await http()
      .get('/prueba/sesion')
      .auth(eterno, { type: 'bearer' })
      .expect(401);
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const ajeno = await new JwtService({
      secret: 'otro-secreto-cualquiera',
    }).signAsync(
      { sub: 'x', scope: 'sesion', companyId: empresas.get(FERRETERIA) },
      { expiresIn: '15m' },
    );
    await http()
      .get('/prueba/sesion')
      .auth(ajeno, { type: 'bearer' })
      .expect(401);
  });
});

describe('RolesGuard', () => {
  it('autoriza cuando su rol está en la lista', async () => {
    await http()
      .get('/prueba/contador-o-revisor')
      .auth(await tokenSesion(JORGE, FERRETERIA), { type: 'bearer' })
      .expect(200);
  });

  it('da 403 cuando su rol no alcanza', async () => {
    await http()
      .get('/prueba/admin')
      .auth(await tokenSesion(JORGE, FERRETERIA), { type: 'bearer' })
      .expect(403);
  });

  it('revocar el rol surte efecto con el mismo token (D-09)', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    await http()
      .get('/prueba/admin')
      .auth(token, { type: 'bearer' })
      .expect(200);

    await ds.query(
      `DELETE FROM user_company_roles
        WHERE company_id = $1
          AND user_id = (SELECT id FROM users WHERE email = $2)`,
      [empresas.get(FERRETERIA), ANA],
    );
    try {
      await http()
        .get('/prueba/admin')
        .auth(token, { type: 'bearer' })
        .expect(403);
      await http()
        .get('/prueba/sesion')
        .auth(token, { type: 'bearer' })
        .expect(403);
    } finally {
      await sembrar(ds);
    }
  });
});

/** CU-03.3: el 403 por rol deja rastro en la bitácora de su empresa. */
describe('Bitácora de accesos denegados', () => {
  interface FilaBitacora {
    company_id: string;
    user_id: string;
    entidad: string;
    entidad_id: string;
    accion: string;
    datos: Record<string, unknown>;
  }

  const SELECT = `SELECT company_id, user_id, entidad, entidad_id, accion, datos
                    FROM bitacora`;

  // La base de pruebas se comparte: una fila 'acceso_denegado' haría fallar
  // el `down` de la migración en los specs que la revierten.
  afterAll(() => ds.query('TRUNCATE bitacora'));

  beforeEach(async () => {
    // Dueño de la tabla: la app no puede borrar bitácora.
    await ds.query('TRUNCATE bitacora');
  });

  it('un 403 por rol crea exactamente una fila con empresa y usuario', async () => {
    await http()
      .get('/prueba/admin')
      .auth(await tokenSesion(JORGE, FERRETERIA), { type: 'bearer' })
      .expect(403);

    const usuario = await una<{ id: string }>(
      ds,
      'SELECT id FROM users WHERE email = $1',
      [JORGE],
    );
    const filas = await ds.query<FilaBitacora[]>(SELECT);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      company_id: empresas.get(FERRETERIA),
      user_id: usuario.id,
      entidad: 'companies',
      entidad_id: empresas.get(FERRETERIA),
      accion: 'acceso_denegado',
      datos: {
        metodo: 'GET',
        ruta: '/prueba/admin',
        motivo: 'rol_insuficiente',
        rolesRequeridos: ['admin'],
        rolesDelUsuario: ['contador'],
      },
    });
  });

  it('otra empresa no ve esa fila (RLS), la suya sí', async () => {
    await http()
      .get('/prueba/admin')
      .auth(await tokenSesion(JORGE, FERRETERIA), { type: 'bearer' })
      .expect(403);

    const transaccion = app.get(TransaccionEmpresa);
    const desde = (rfc: string) =>
      transaccion.ejecutar(empresas.get(rfc) ?? rfc, (manager) =>
        filas<FilaBitacora>(manager, SELECT),
      );
    expect(await desde(TRANSPORTES)).toHaveLength(0);
    expect(await desde(FERRETERIA)).toHaveLength(1);
  });

  it('sin membresía vigente se registra en la empresa del token', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    await ds.query(
      `DELETE FROM user_company_roles
        WHERE company_id = $1
          AND user_id = (SELECT id FROM users WHERE email = $2)`,
      [empresas.get(FERRETERIA), ANA],
    );
    try {
      await http()
        .get('/prueba/sesion')
        .auth(token, { type: 'bearer' })
        .expect(403);
    } finally {
      await sembrar(ds);
    }

    const filas = await ds.query<FilaBitacora[]>(SELECT);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      company_id: empresas.get(FERRETERIA),
      datos: { motivo: 'sin_membresia', rolesDelUsuario: [] },
    });
  });

  it('un acceso permitido no escribe nada', async () => {
    await http()
      .get('/prueba/contador-o-revisor')
      .auth(await tokenSesion(JORGE, FERRETERIA), { type: 'bearer' })
      .expect(200);
    expect(await ds.query(SELECT)).toHaveLength(0);
  });

  it('si la bitácora falla, la respuesta sigue siendo 403', async () => {
    const espia = jest
      .spyOn(TransaccionEmpresa.prototype, 'ejecutar')
      .mockRejectedValue(new Error('base caída'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await http()
        .get('/prueba/admin')
        .auth(await tokenSesion(JORGE, FERRETERIA), { type: 'bearer' })
        .expect(403);
      expect(espia).toHaveBeenCalled();
    } finally {
      jest.restoreAllMocks();
    }
    expect(await ds.query(SELECT)).toHaveLength(0);
  });
});
