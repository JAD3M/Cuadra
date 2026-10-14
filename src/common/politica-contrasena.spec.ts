import {
  LARGO_MAXIMO_PASSWORD,
  LARGO_MINIMO_PASSWORD,
  mensajePasswordInvalida,
} from './politica-contrasena';

describe('política de contraseña v1', () => {
  it('fija el mínimo en 12 y el máximo en 256', () => {
    expect(LARGO_MINIMO_PASSWORD).toBe(12);
    expect(LARGO_MAXIMO_PASSWORD).toBe(256);
  });

  it('acepta los extremos del rango', () => {
    expect(mensajePasswordInvalida('a'.repeat(12))).toBeNull();
    expect(mensajePasswordInvalida('a'.repeat(256))).toBeNull();
  });

  it('rechaza una contraseña corta con mensaje claro', () => {
    expect(mensajePasswordInvalida('a'.repeat(11))).toBe(
      'La contraseña debe tener al menos 12 caracteres.',
    );
  });

  it('rechaza una contraseña demasiado larga', () => {
    expect(mensajePasswordInvalida('a'.repeat(257))).toBe(
      'La contraseña no puede tener más de 256 caracteres.',
    );
  });

  it.each([undefined, null, '', 42])(
    'trata %p como ausente y exige el mínimo',
    (valor) => {
      expect(mensajePasswordInvalida(valor)).toBe(
        'La contraseña debe tener al menos 12 caracteres.',
      );
    },
  );
});
