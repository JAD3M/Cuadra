import { describe, expect, it } from 'vitest';
import {
  CONTEXTO_SESION,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN,
  RESPUESTA_TOKEN,
  USUARIO,
} from '@/test/fixtures';
import {
  contextoSesion,
  cuerpoError,
  empresaDisponible,
  listaEmpresasDisponibles,
  respuestaLogin,
  respuestaToken,
  rol,
  solicitudLogin,
  usuarioPublico,
} from './auth';

describe('contratos de autenticación: cargas válidas', () => {
  it('parsea la respuesta de login', () => {
    expect(respuestaLogin.parse(RESPUESTA_LOGIN)).toEqual(RESPUESTA_LOGIN);
  });

  it('parsea GET /auth/empresas como arreglo sin envoltorio', () => {
    expect(listaEmpresasDisponibles.parse(EMPRESAS_DISPONIBLES)).toEqual(
      EMPRESAS_DISPONIBLES,
    );
  });

  it('parsea el contexto de sesión', () => {
    expect(contextoSesion.parse(CONTEXTO_SESION)).toEqual(CONTEXTO_SESION);
  });

  it('parsea la respuesta de token', () => {
    expect(respuestaToken.parse(RESPUESTA_TOKEN)).toEqual(RESPUESTA_TOKEN);
  });

  it('parsea la solicitud de login', () => {
    const cuerpo = { email: 'ana@fdb.mx', password: ' con espacios ' };
    expect(solicitudLogin.parse(cuerpo)).toEqual(cuerpo);
  });

  it('acepta una empresa sin roles asignados como lista vacía', () => {
    const vacia = { ...EMPRESAS_DISPONIBLES[0], roles: [] };
    expect(empresaDisponible.parse(vacia).roles).toEqual([]);
  });

  it('ignora claves desconocidas del backend sin romper', () => {
    const conExtra = { ...USUARIO, activo: true };
    expect(usuarioPublico.parse(conExtra)).toEqual(USUARIO);
  });
});

describe('contratos de autenticación: roles fuera del espejo', () => {
  it('rechaza el rol superuser en una empresa disponible', () => {
    const mala = { ...EMPRESAS_DISPONIBLES[0], roles: ['admin', 'superuser'] };
    expect(empresaDisponible.safeParse(mala).success).toBe(false);
  });

  it('rechaza el rol superuser dentro del login completo', () => {
    const mala = {
      ...RESPUESTA_LOGIN,
      empresas: [{ ...EMPRESAS_DISPONIBLES[0], roles: ['superuser'] }],
    };
    expect(respuestaLogin.safeParse(mala).success).toBe(false);
  });

  it('rechaza el rol superuser en el contexto de sesión', () => {
    const mala = { ...CONTEXTO_SESION, roles: ['superuser'] };
    expect(contextoSesion.safeParse(mala).success).toBe(false);
  });

  it.each(['Admin', 'ADMIN', '', 1, null])(
    'rol exige el valor exacto del espejo (rechaza %j)',
    (valor) => {
      expect(rol.safeParse(valor).success).toBe(false);
    },
  );

  it.each(['admin', 'contador', 'revisor'])('rol acepta %s', (valor) => {
    expect(rol.parse(valor)).toBe(valor);
  });
});

describe('contratos de autenticación: formas incorrectas fallan', () => {
  it('rechaza un login sin token', () => {
    const { token: _token, ...sinToken } = RESPUESTA_LOGIN;
    void _token;
    expect(respuestaLogin.safeParse(sinToken).success).toBe(false);
  });

  it('rechaza un token vacío o que no es cadena', () => {
    expect(respuestaToken.safeParse({ token: '' }).success).toBe(false);
    expect(respuestaToken.safeParse({ token: 123 }).success).toBe(false);
  });

  it('rechaza roles que no son arreglo', () => {
    const mala = { ...CONTEXTO_SESION, roles: 'admin' };
    expect(contextoSesion.safeParse(mala).success).toBe(false);
  });

  it('rechaza un contexto sin empresa', () => {
    const { empresa: _empresa, ...sinEmpresa } = CONTEXTO_SESION;
    void _empresa;
    expect(contextoSesion.safeParse(sinEmpresa).success).toBe(false);
  });

  it('rechaza id que no es UUID y correo inválido', () => {
    expect(usuarioPublico.safeParse({ ...USUARIO, id: '123' }).success).toBe(
      false,
    );
    expect(
      usuarioPublico.safeParse({ ...USUARIO, email: 'no-es-correo' }).success,
    ).toBe(false);
  });

  it('rechaza una solicitud de login sin contraseña', () => {
    expect(
      solicitudLogin.safeParse({ email: 'ana@fdb.mx', password: '' }).success,
    ).toBe(false);
  });

  it('rechaza un campo con forma de monto enviado como número', () => {
    // Un contrato con montos usa `montoDecimal`; este caso fija que una cadena
    // vacía o un número en un campo de texto no se coaccionan.
    expect(
      empresaDisponible.safeParse({ ...EMPRESAS_DISPONIBLES[0], rfc: 12.5 })
        .success,
    ).toBe(false);
  });
});

describe('cuerpoError', () => {
  it('acepta message como texto', () => {
    const cuerpo = {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'No autorizado',
    };
    expect(cuerpoError.parse(cuerpo)).toEqual(cuerpo);
  });

  it('acepta message como arreglo de textos', () => {
    const cuerpo = {
      statusCode: 400,
      error: 'Bad Request',
      message: ['email must be an email', 'password should not be empty'],
    };
    expect(cuerpoError.parse(cuerpo)).toEqual(cuerpo);
  });

  it.each([
    { statusCode: '400', error: 'x', message: 'x' },
    { statusCode: 400, error: 'x', message: 5 },
    { statusCode: 400, error: 'x', message: ['a', 1] },
    { statusCode: 400, error: 'x' },
  ])('rechaza el cuerpo malformado %j', (malo) => {
    expect(cuerpoError.safeParse(malo).success).toBe(false);
  });
});
