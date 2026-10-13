import { DataSource } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import {
  crearBaseDePruebas,
  filas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { PasswordHasher } from '../auth/password';
import {
  ErrorSiembraDueno,
  PASSWORD_MINIMO_DUENO,
  sembrarDueno,
} from './sembrar-dueno';

/**
 * Historia 1.3. Siembra del dueño de Cuadra contra Postgres real: el CHECK de
 * correo normalizado y la tabla viva en el motor.
 */

let ds: DataSource;
const hasher = new PasswordHasher();
const PASSWORD_VALIDA = 'una-clave-larga-12';

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
}, 60_000);

beforeEach(async () => {
  await ds.query(
    'DELETE FROM sesiones WHERE plataforma_usuario_id IS NOT NULL',
  );
  await ds.query('DELETE FROM plataforma_usuarios');
});

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

async function cuenta(): Promise<number> {
  const [{ n }] = await filas<{ n: string }>(
    ds,
    'SELECT count(*) AS n FROM plataforma_usuarios',
  );
  return Number(n);
}

describe('sembrarDueno', () => {
  it('crea al dueño con la contraseña hasheada y verificable', async () => {
    await sembrarDueno(ds, {
      correo: 'dueno@cuadra.mx',
      password: PASSWORD_VALIDA,
    });

    const [fila] = await filas<{
      correo: string;
      password_hash: string;
      activo: boolean;
    }>(ds, 'SELECT correo, password_hash, activo FROM plataforma_usuarios');
    expect(fila.correo).toBe('dueno@cuadra.mx');
    expect(fila.activo).toBe(true);
    expect(fila.password_hash).not.toContain(PASSWORD_VALIDA);
    expect(await hasher.verificar(PASSWORD_VALIDA, fila.password_hash)).toBe(
      true,
    );
    expect(
      await hasher.verificar('otra-clave-larga-1', fila.password_hash),
    ).toBe(false);
  });

  it('normaliza el correo (minúsculas, sin espacios)', async () => {
    await sembrarDueno(ds, {
      correo: '  Dueno@Cuadra.MX ',
      password: PASSWORD_VALIDA,
    });
    const [fila] = await filas<{ correo: string }>(
      ds,
      'SELECT correo FROM plataforma_usuarios',
    );
    expect(fila.correo).toBe('dueno@cuadra.mx');
  });

  it('se niega si la tabla ya tiene una fila y no escribe nada', async () => {
    await sembrarDueno(ds, {
      correo: 'dueno@cuadra.mx',
      password: PASSWORD_VALIDA,
    });
    await expect(
      sembrarDueno(ds, { correo: 'otro@cuadra.mx', password: PASSWORD_VALIDA }),
    ).rejects.toBeInstanceOf(ErrorSiembraDueno);
    expect(await cuenta()).toBe(1);
  });

  it.each([
    ['correo ausente', undefined, PASSWORD_VALIDA],
    ['correo en blanco', '   ', PASSWORD_VALIDA],
    ['contraseña ausente', 'dueno@cuadra.mx', undefined],
    ['contraseña en blanco', 'dueno@cuadra.mx', '            '],
    ['contraseña vacía', 'dueno@cuadra.mx', ''],
  ])('se niega con %s', async (_caso, correo, password) => {
    await expect(sembrarDueno(ds, { correo, password })).rejects.toBeInstanceOf(
      ErrorSiembraDueno,
    );
    expect(await cuenta()).toBe(0);
  });

  it('se niega con un correo sin forma de correo', async () => {
    await expect(
      sembrarDueno(ds, { correo: 'no-es-correo', password: PASSWORD_VALIDA }),
    ).rejects.toBeInstanceOf(ErrorSiembraDueno);
    expect(await cuenta()).toBe(0);
  });

  it('rechaza 11 caracteres y acepta 12', async () => {
    expect(PASSWORD_MINIMO_DUENO).toBe(12);
    await expect(
      sembrarDueno(ds, { correo: 'dueno@cuadra.mx', password: 'a'.repeat(11) }),
    ).rejects.toBeInstanceOf(ErrorSiembraDueno);
    expect(await cuenta()).toBe(0);

    await sembrarDueno(ds, {
      correo: 'dueno@cuadra.mx',
      password: 'a'.repeat(12),
    });
    expect(await cuenta()).toBe(1);
  });

  it('nunca incluye la contraseña ni el hash en el error ni en la consola', async () => {
    const espias = (['log', 'info', 'warn', 'error'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const secreto = 'corto-123';
    let mensaje = '';
    try {
      await sembrarDueno(ds, { correo: 'dueno@cuadra.mx', password: secreto });
    } catch (e) {
      mensaje = (e as Error).message;
    }
    await sembrarDueno(ds, {
      correo: 'dueno@cuadra.mx',
      password: PASSWORD_VALIDA,
    });
    await expect(
      sembrarDueno(ds, { correo: 'x@cuadra.mx', password: PASSWORD_VALIDA }),
    ).rejects.toThrow();
    const [{ password_hash: hash }] = await filas<{ password_hash: string }>(
      ds,
      'SELECT password_hash FROM plataforma_usuarios',
    );
    const salida = espias
      .flatMap((e) => e.mock.calls)
      .flat()
      .join(' ');
    espias.forEach((e) => e.mockRestore());

    expect(mensaje).toContain('12');
    expect(mensaje).not.toContain(secreto);
    expect(salida).not.toContain(PASSWORD_VALIDA);
    expect(salida).not.toContain(hash);
  });
});
