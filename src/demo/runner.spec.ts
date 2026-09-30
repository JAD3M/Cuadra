import { PASSWORD_SEMILLA } from '../database/seeds/seed';
import {
  coincide,
  ErrorDemo,
  PASSWORD_DEMO,
  resumir,
  validarDestino,
} from '../../scripts/demo/runner';
import { esperado } from '../../scripts/demo/escenarios';

describe('runner de la demo: partes puras (CU-18)', () => {
  describe('guarda de loopback', () => {
    it.each([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://[::1]:3000',
    ])('acepta %s', (url) => {
      expect(() => validarDestino(url, {})).not.toThrow();
    });

    it.each([
      'https://cuadra.ejemplo.mx',
      'http://10.0.0.5:3000',
      'http://localhost.evil.com',
    ])('rechaza %s sin DEMO_PERMITIR_REMOTO', (url) => {
      expect(() => validarDestino(url, {})).toThrow(ErrorDemo);
    });

    it('DEMO_PERMITIR_REMOTO=1 la desactiva; otro valor no', () => {
      const remoto = 'https://cuadra.ejemplo.mx';
      expect(() =>
        validarDestino(remoto, { DEMO_PERMITIR_REMOTO: '1' }),
      ).not.toThrow();
      expect(() =>
        validarDestino(remoto, { DEMO_PERMITIR_REMOTO: 'true' }),
      ).toThrow();
    });

    it('una URL inválida es un error claro, no un TypeError', () => {
      expect(() => validarDestino('no es una url', {})).toThrow(ErrorDemo);
    });
  });

  it('la contraseña del runner es la del seed', () => {
    expect(PASSWORD_DEMO).toBe(PASSWORD_SEMILLA);
  });

  describe('comparación contra lo esperado', () => {
    const fase1 = esperado('fase1', 'fdb');

    it('una bandeja igual a lo esperado coincide', () => {
      expect(coincide(fase1, fase1)).toBe(true);
    });

    it('una regla de más o de menos no coincide aunque los totales sí', () => {
      const movida = {
        ...fase1,
        porRegla: {
          ...fase1.porRegla,
          monto_unico: fase1.porRegla.monto_unico - 1,
          referencia_monto_exacto: fase1.porRegla.referencia_monto_exacto + 1,
        },
      };
      expect(coincide(movida, fase1)).toBe(false);
    });

    it('resumir cuenta por estado y regla, y deja fuera a los conciliados de las reglas', () => {
      const fila = (estado: string, regla: string | null) =>
        ({ estado, regla }) as Parameters<typeof resumir>[0][number];
      const r = resumir([
        fila('sugerencia', 'llm_sugerencia'),
        fila('sugerencia', 'monto_unico'),
        fila('sin_match', 'sin_candidato_monto'),
        fila('conciliado', 'referencia_monto_exacto'),
      ]);
      expect(r).toEqual({
        sugerencia: 2,
        sin_match: 1,
        conciliado: 1,
        porRegla: { llm_sugerencia: 1, monto_unico: 1, sin_candidato_monto: 1 },
        ia: 1,
      });
    });
  });
});
