import { zodResolver } from '@hookform/resolvers/zod';
import { describe, expect, it } from 'vitest';
import { solicitudLogin } from '@/shared/api/contratos';
import { esquemaLogin } from './esquemaLogin';

describe('esquemaLogin', () => {
  it('recorta el correo y deja la contraseña intacta', () => {
    const r = esquemaLogin.parse({
      email: '  jorge@despacho.mx  ',
      password: ' con espacios ',
    });
    expect(r).toEqual({
      email: 'jorge@despacho.mx',
      password: ' con espacios ',
    });
  });

  it('su salida cumple el contrato de la API (no hay una segunda definición)', () => {
    const r = esquemaLogin.parse({ email: ' a@b.mx ', password: 'x' });
    expect(solicitudLogin.safeParse(r).success).toBe(true);
    expect(Object.keys(esquemaLogin.shape).sort()).toEqual(
      Object.keys(solicitudLogin.shape).sort(),
    );
  });

  it('da los mensajes en español', () => {
    const r = esquemaLogin.safeParse({ email: 'no-es-correo', password: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const mensajes = Object.fromEntries(
        r.error.issues.map((i) => [String(i.path[0]), i.message]),
      );
      expect(mensajes).toEqual({
        email: 'Escribe un correo válido',
        password: 'Escribe tu contraseña',
      });
    }
  });

  it('un correo de solo espacios es inválido', () => {
    expect(
      esquemaLogin.safeParse({ email: '   ', password: 'x' }).success,
    ).toBe(false);
  });

  it('el resolver de react-hook-form entrega valores tipados y mensajes', async () => {
    const resolver = zodResolver(esquemaLogin);
    const ok = await resolver({ email: ' a@b.mx ', password: 'x' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(ok.errors).toEqual({});
    expect(ok.values).toEqual({ email: 'a@b.mx', password: 'x' });

    const mal = await resolver({ email: '', password: '' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(mal.errors.email?.message).toBe('Escribe un correo válido');
    expect(mal.errors.password?.message).toBe('Escribe tu contraseña');
  });
});
