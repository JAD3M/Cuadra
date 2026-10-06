// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGLA_REFERENCIA_MONTO_EXACTO } from '@/shared/dominio/reglas';

const RUTA = path.resolve(
  import.meta.dirname,
  '../../../src/conciliacion/evaluar-par.ts',
);

describe('espejo de la regla de referencia exacta (src/conciliacion/evaluar-par.ts)', () => {
  const texto = fs.readFileSync(RUTA, 'utf8');
  const extraer = (fuente: string) =>
    /export const REGLA_REFERENCIA_MONTO_EXACTO = '([^']+)'/.exec(fuente)?.[1];

  it('el espejo coincide con el código que escribe el backend', () => {
    expect(extraer(texto)).toBe(REGLA_REFERENCIA_MONTO_EXACTO);
  });

  it('cambiar el código en el backend falla', () => {
    const fuente = texto.replace("'referencia_monto_exacto'", "'otra_regla'");
    expect(fuente).not.toBe(texto);
    expect(extraer(fuente)).not.toBe(REGLA_REFERENCIA_MONTO_EXACTO);
  });

  it('si el backend deja de declarar la constante, la extracción no encuentra nada', () => {
    expect(extraer('// vacío')).toBeUndefined();
  });
});
