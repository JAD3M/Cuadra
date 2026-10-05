// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREFIJO_MOTIVO_SIMULADO } from '@/features/bandeja/ia';
import { extraerExportsBackend } from './derivaTipos';

/**
 * El motivo de una sugerencia simulada se guarda como `PREFIJO_MOTIVO` +
 * `ETIQUETA_SIMULADA` (+ texto). La insignia «simulada» depende de ese prefijo
 * exacto: si el backend cambia cualquiera de las dos constantes, esta prueba
 * falla en vez de dejar que la insignia deje de aparecer en silencio.
 */
function constantesDe(rutaRelativa: string): Record<string, string | number> {
  const ruta = path.resolve(import.meta.dirname, '../../../', rutaRelativa);
  return extraerExportsBackend(fs.readFileSync(ruta, 'utf8'), ruta).constantes;
}

describe('prefijo de la sugerencia simulada frente al backend', () => {
  const validar = constantesDe('src/sugerencias/validar-sugerencia.ts');
  const proveedor = constantesDe('src/sugerencias/proveedor-simulado.ts');

  it('encuentra las dos constantes del backend', () => {
    expect(typeof validar.PREFIJO_MOTIVO).toBe('string');
    expect(typeof proveedor.ETIQUETA_SIMULADA).toBe('string');
  });

  it('el prefijo del frontend es PREFIJO_MOTIVO + ETIQUETA_SIMULADA', () => {
    expect(PREFIJO_MOTIVO_SIMULADO).toBe(
      `${String(validar.PREFIJO_MOTIVO)}${String(proveedor.ETIQUETA_SIMULADA)}`,
    );
  });
});
