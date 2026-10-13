import { Controller, Get, type INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { App } from 'supertest/types';
import { DataSource, type Repository } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { PasswordHasher } from '../auth/password';
import { COOKIE_SESION, huellaDeToken } from '../auth/sesiones.service';
import { validateEnv } from '../config/env.validation';
import { configurarApp } from '../configurar-app';
import { opcionesDataSource } from '../database/data-source';
import { ENTIDADES } from '../database/entidades';
import { SnakeNamingStrategy } from '../database/naming.strategy';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { limpiarLimites } from '../testing/limites-de-pruebas';
import {
  abrirSesion,
  cookieDe,
  setCookieDe,
} from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';
import { ACCIONES_BITACORA_PLATAFORMA } from '../common/entities/tipos';
import { BitacoraPlataforma } from './bitacora-plataforma.entity';
import { RegistroPlataforma } from './registro-plataforma.service';

const PREFIJO_LIMITE = 'cuadra_test_plataforma';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 1.3 (AD-5): sesión de plataforma, login propio y separación de
 * mundos. Postgres y Redis reales; la app corre como cuadra_app.
 */

/** Ruta de empresa de mentira: aún no hay otra que no abra transacción. */
@Controller('prueba')
class ControladorDeEmpresa {
  @Get('sesion')
  sesion() {
    return { ok: true };
  }
}

const CORREO_DUENO = 'dueno-login@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const CORREO_INACTIVO = 'dueno-inactivo@cuadra.test';
const ANA = 'ana.reyes@fdb.mx';
const FERRETERIA = 'FDB190215QK4';

let app: INestApplication<App>;
let ds: DataSource;
let duenoId: string;
let anaId: string;
let ferreteriaId: string;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);

  const hash = await new PasswordHasher().hashear(PASSWORD_DUENO);
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ($1, $2) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = true`,
    [CORREO_DUENO, hash],
  );
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash, activo)
     VALUES ($1, $2, false) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = false`,
    [CORREO_INACTIVO, hash],
  );
  duenoId = (
    await una<{ id: string }>(
      ds,
      'SELECT id FROM plataforma_usuarios WHERE correo = $1',
      [CORREO_DUENO],
    )
  ).id;
  anaId = (
    await una<{ id: string }>(ds, 'SELECT id FROM users WHERE email = $1', [
      ANA,
    ])
  ).id;
  ferreteriaId = (
    await una<{ id: string }>(ds, 'SELECT id FROM companies WHERE rfc = $1', [
      FERRETERIA,
    ])
  ).id;

  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: urlAppDePruebas(),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      AuthModule,
    ],
    controllers: [ControladorDeEmpresa],
  }).compile();
  app = modulo.createNestApplication();
  configurarApp(app);
  await app.listen(0);
}, 60_000);

afterAll(async () => {
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    // La bitácora es de solo agregar para cuadra_app; el dueño del esquema
    // limpia lo de esta suite para no estorbar a las que borran cuentas.
    await ds.query('DELETE FROM bitacora_plataforma');
    await ds.query(
      'DELETE FROM sesiones WHERE plataforma_usuario_id IS NOT NULL',
    );
    await ds.query('DELETE FROM plataforma_usuarios WHERE correo = ANY($1)', [
      [CORREO_DUENO, CORREO_INACTIVO],
    ]);
    await ds.destroy();
  }
});

beforeEach(async () => {
  await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
});

const http = () => request(app.getHttpServer());

async function loginDueno(): Promise<string> {
  const res = await http()
    .post('/plataforma/auth/login')
    .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
    .expect(200);
  return cookieDe(res);
}

interface FilaBitacora {
  accion: string;
  plataforma_usuario_id: string | null;
  company_id: string | null;
  detalle: Record<string, unknown> | null;
}

async function bitacoraDe(
  accion: string,
  desde: Date,
): Promise<FilaBitacora[]> {
  return await filas<FilaBitacora>(
    ds,
    `SELECT accion, plataforma_usuario_id, company_id, detalle
       FROM bitacora_plataforma
      WHERE accion = $1 AND created_at >= $2
      ORDER BY created_at`,
    [accion, desde],
  );
}

describe('POST /plataforma/auth/login', () => {
  it('abre una sesión plataforma sin company_id y pone la cookie', async () => {
    const desde = new Date();
    const res = await http()
      .post('/plataforma/auth/login')
      .send({
        email: ` ${CORREO_DUENO.toUpperCase()} `,
        password: PASSWORD_DUENO,
      })
      .expect(200);

    const fija = setCookieDe(res) as string;
    expect(fija).toMatch(/HttpOnly/i);
    expect(fija).toMatch(/Secure/i);
    expect(fija).toMatch(/SameSite=Lax/i);
    expect(fija).toContain(`Max-Age=${8 * 60 * 60}`);

    expect(res.body).toEqual({
      usuario: { id: duenoId, correo: CORREO_DUENO },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/token|password|hash/i);

    const token = fija.split(';')[0].split('=')[1];
    const sesion = await una<{
      tipo: string;
      company_id: string | null;
      user_id: string | null;
      plataforma_usuario_id: string;
    }>(ds, 'SELECT * FROM sesiones WHERE token_hash = $1', [
      huellaDeToken(token),
    ]);
    expect(sesion.tipo).toBe('plataforma');
    expect(sesion.company_id).toBeNull();
    expect(sesion.user_id).toBeNull();
    expect(sesion.plataforma_usuario_id).toBe(duenoId);

    const [fila] = await bitacoraDe('iniciar_sesion_plataforma', desde);
    expect(fila.plataforma_usuario_id).toBe(duenoId);
    expect(JSON.stringify(fila.detalle)).not.toContain(token);
  });

  it('contraseña errada y correo inexistente dan el mismo 401', async () => {
    const mala = await http()
      .post('/plataforma/auth/login')
      .send({ email: CORREO_DUENO, password: 'incorrecta' })
      .expect(401);
    const inexistente = await http()
      .post('/plataforma/auth/login')
      .send({ email: 'nadie@cuadra.test', password: 'incorrecta' })
      .expect(401);
    expect(mala.body).toEqual(inexistente.body);
    expect((mala.body as { message: string }).message).toBe(
      'Credenciales inválidas',
    );
    expect(setCookieDe(mala)).toBeUndefined();
  });

  it('una cuenta inactiva recibe el mismo 401, aun con la contraseña correcta', async () => {
    const res = await http()
      .post('/plataforma/auth/login')
      .send({ email: CORREO_INACTIVO, password: PASSWORD_DUENO })
      .expect(401);
    const referencia = await http()
      .post('/plataforma/auth/login')
      .send({ email: CORREO_DUENO, password: 'incorrecta' })
      .expect(401);
    expect(res.body).toEqual(referencia.body);
  });

  it('un usuario de empresa no entra por aquí', async () => {
    await http()
      .post('/plataforma/auth/login')
      .send({ email: ANA, password: 'cualquiera' })
      .expect(401);
  });

  it('el sexto intento fallido desde la misma IP responde 429', async () => {
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/plataforma/auth/login')
        .send({ email: CORREO_DUENO, password: 'incorrecta' })
        .expect(401);
    }
    const res = await http()
      .post('/plataforma/auth/login')
      .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
      .expect(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('un login correcto cierra la sesión anterior de la misma cookie', async () => {
    const anterior = await loginDueno();
    await http()
      .post('/plataforma/auth/login')
      .set('Cookie', anterior)
      .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
      .expect(200);
    await http()
      .get('/plataforma/empresas')
      .set('Cookie', anterior)
      .expect(401);
  });
});

describe('GET /plataforma/auth/me', () => {
  it('con sesión plataforma responde 200 con id y correo del dueño', async () => {
    const res = await http()
      .get('/plataforma/auth/me')
      .set('Cookie', await loginDueno())
      .expect(200);
    expect(res.body).toEqual({
      usuario: { id: duenoId, correo: CORREO_DUENO },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/token|password|hash/i);
  });

  it('sin cookie responde 401', async () => {
    await http().get('/plataforma/auth/me').expect(401);
  });

  it('una sesión de empresa responde 403 y deja el acceso en la bitácora', async () => {
    const desde = new Date();
    const cookie = await abrirSesion(ds, anaId, ferreteriaId);
    await http().get('/plataforma/auth/me').set('Cookie', cookie).expect(403);
    const [fila] = await bitacoraDe('acceso_denegado', desde);
    expect(fila.company_id).toBe(ferreteriaId);
    expect(fila.detalle).toMatchObject({
      metodo: 'GET',
      ruta: '/plataforma/auth/me',
      tipoSesion: 'empresa',
    });
  });

  it('un dueño desactivado con la sesión viva recibe 401', async () => {
    const cookie = await loginDueno();
    await ds.query(
      'UPDATE plataforma_usuarios SET activo = false WHERE id = $1',
      [duenoId],
    );
    try {
      await http().get('/plataforma/auth/me').set('Cookie', cookie).expect(401);
    } finally {
      await ds.query(
        'UPDATE plataforma_usuarios SET activo = true WHERE id = $1',
        [duenoId],
      );
    }
  });

  it('no deja filas en bitacora_plataforma al leer', async () => {
    const cookie = await loginDueno();
    const antes = await una<{ n: string }>(
      ds,
      'SELECT count(*)::text AS n FROM bitacora_plataforma',
    );
    await http().get('/plataforma/auth/me').set('Cookie', cookie).expect(200);
    const despues = await una<{ n: string }>(
      ds,
      'SELECT count(*)::text AS n FROM bitacora_plataforma',
    );
    expect(despues.n).toBe(antes.n);
  });
});

describe('GET /plataforma/empresas', () => {
  it('la sesión plataforma recibe la lista, vacía al inicio', async () => {
    const res = await http()
      .get('/plataforma/empresas')
      .set('Cookie', await loginDueno())
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('sin sesión responde 401', async () => {
    await http().get('/plataforma/empresas').expect(401);
  });

  it('una sesión plataforma vencida responde 401', async () => {
    const cookie = await loginDueno();
    await ds.query(
      `UPDATE sesiones SET expira_en = now() - interval '1 minute'
        WHERE token_hash = $1`,
      [huellaDeToken(cookie.split('=')[1])],
    );
    await http().get('/plataforma/empresas').set('Cookie', cookie).expect(401);
  });

  it('una sesión de empresa responde 403 y deja el acceso en la bitácora de plataforma', async () => {
    const desde = new Date();
    const cookie = await abrirSesion(ds, anaId, ferreteriaId);
    const res = await http()
      .get('/plataforma/empresas')
      .set('Cookie', cookie)
      .expect(403);
    expect(JSON.stringify(res.body)).not.toContain(cookie.split('=')[1]);

    const [fila] = await bitacoraDe('acceso_denegado', desde);
    expect(fila.plataforma_usuario_id).toBeNull();
    expect(fila.company_id).toBe(ferreteriaId);
    expect(fila.detalle).toMatchObject({
      metodo: 'GET',
      ruta: '/plataforma/empresas',
      tipoSesion: 'empresa',
    });
    expect(JSON.stringify(fila.detalle)).not.toContain(cookie.split('=')[1]);
  });

  it('una sesión de empresa sin empresa elegida también responde 403', async () => {
    const desde = new Date();
    const cookie = await abrirSesion(ds, anaId, null);
    await http().get('/plataforma/empresas').set('Cookie', cookie).expect(403);
    const [fila] = await bitacoraDe('acceso_denegado', desde);
    expect(fila.company_id).toBeNull();
  });
});

describe('sesión plataforma en rutas de empresa', () => {
  it('responde 403 y deja el acceso con la cuenta de plataforma', async () => {
    const desde = new Date();
    const cookie = await loginDueno();
    await http().get('/prueba/sesion').set('Cookie', cookie).expect(403);

    const [fila] = await bitacoraDe('acceso_denegado', desde);
    expect(fila.plataforma_usuario_id).toBe(duenoId);
    expect(fila.company_id).toBeNull();
    expect(fila.detalle).toMatchObject({
      metodo: 'GET',
      ruta: '/prueba/sesion',
      tipoSesion: 'plataforma',
    });
  });

  it('no puede listar ni elegir empresa por /auth', async () => {
    const cookie = await loginDueno();
    await http().get('/auth/empresas').set('Cookie', cookie).expect(403);
    await http()
      .post(`/auth/empresa/${ferreteriaId}`)
      .set('Cookie', cookie)
      .expect(403);
    await http().get('/auth/contexto').set('Cookie', cookie).expect(403);
    const sesion = await una<{ company_id: string | null }>(
      ds,
      'SELECT company_id FROM sesiones WHERE token_hash = $1',
      [huellaDeToken(cookie.split('=')[1])],
    );
    expect(sesion.company_id).toBeNull();
  });
});

describe('POST /plataforma/auth/logout', () => {
  it('borra la fila, limpia la cookie y deja la acción', async () => {
    const desde = new Date();
    const cookie = await loginDueno();
    const res = await http()
      .post('/plataforma/auth/logout')
      .set('Cookie', cookie)
      .expect(204);
    expect(setCookieDe(res)).toContain(`${COOKIE_SESION}=;`);

    const [fila] = await bitacoraDe('cerrar_sesion_plataforma', desde);
    expect(fila.plataforma_usuario_id).toBe(duenoId);
    await http().get('/plataforma/empresas').set('Cookie', cookie).expect(401);
  });

  it('es idempotente sin cookie y no deja fila', async () => {
    const desde = new Date();
    await http().post('/plataforma/auth/logout').expect(204);
    expect(await bitacoraDe('cerrar_sesion_plataforma', desde)).toEqual([]);
  });
});

describe('transacción de empresa', () => {
  it('una sesión plataforma nunca abre una transacción de empresa', async () => {
    const transaccion = app.get(TransaccionEmpresa);
    const espia = jest.spyOn(transaccion, 'ejecutar');
    try {
      const cookie = await loginDueno();
      await http()
        .get('/plataforma/empresas')
        .set('Cookie', cookie)
        .expect(200);
      // Tampoco al ser rechazada en una ruta de empresa.
      await http().get('/prueba/sesion').set('Cookie', cookie).expect(403);
      expect(espia).not.toHaveBeenCalled();
    } finally {
      espia.mockRestore();
    }
  });
});

describe('bitacora_plataforma', () => {
  it('cuadra_app solo agrega: UPDATE y DELETE siguen prohibidos', async () => {
    const appDs = app.get(DataSource);
    await expect(
      appDs.query(`UPDATE bitacora_plataforma SET accion = 'acceso_denegado'`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      appDs.query('DELETE FROM bitacora_plataforma'),
    ).rejects.toThrow(/permission denied/);
  });

  it('el CHECK solo admite las acciones de ACCIONES_BITACORA_PLATAFORMA', async () => {
    for (const accion of ACCIONES_BITACORA_PLATAFORMA) {
      await ds.query(`INSERT INTO bitacora_plataforma (accion) VALUES ($1)`, [
        accion,
      ]);
    }
    await expect(
      ds.query(`INSERT INTO bitacora_plataforma (accion) VALUES ('inventada')`),
    ).rejects.toThrow(/ck_bitacora_plataforma_accion/);
  });
});

describe('RegistroPlataforma', () => {
  it('nunca lanza: si la inserción falla, el error queda en el log', async () => {
    const repo = {
      create: jest.fn((fila: unknown) => fila),
      save: jest.fn().mockRejectedValue(new Error('base caída')),
    } as unknown as Repository<BitacoraPlataforma>;
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    try {
      const registro = new RegistroPlataforma(repo);
      await expect(
        registro.registrar({ accion: 'acceso_denegado', detalle: {} }),
      ).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
});
