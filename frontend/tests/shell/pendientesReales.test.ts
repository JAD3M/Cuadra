// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');
const leer = (ruta: string) => readFileSync(resolve(SRC, ruta), 'utf8');

describe('el contador de la barra lateral ya no usa el marcador', () => {
  it('el archivo del marcador no existe', () => {
    expect(existsSync(resolve(SRC, 'app/shell/pendientesPlaceholder.ts'))).toBe(
      false,
    );
  });

  it.each(['app/shell/ShellLayout.tsx', 'app/shell/index.ts'])(
    '%s no importa ni reexporta el marcador',
    (archivo) => {
      expect(leer(archivo)).not.toMatch(/PENDIENTES_PLACEHOLDER/);
      expect(leer(archivo)).not.toMatch(/pendientesPlaceholder/);
    },
  );

  it('el contenedor del shell toma el contador del resumen compartido', () => {
    expect(leer('app/shell/ShellLayout.tsx')).toContain('usePendientesBandeja');
  });
});
