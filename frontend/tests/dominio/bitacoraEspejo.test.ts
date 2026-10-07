// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MOTIVO_ROL_INSUFICIENTE,
  MOTIVO_SIN_MEMBRESIA,
  ROLES,
} from '@/shared/dominio';
import { LIMITE_PAGINA } from '@/features/bitacora/constantes';

// Deriva de los espejos de la bitácora (CU-26) contra el backend. Mismo patrón
// que toleranciaEspejo.test.ts: el espejo coincide con el código, y cambiar el
// código allá (o quitar el literal) hace fallar la comprobación nombrando la
// constante. Solo LEE archivos del backend; las mutaciones sintéticas se hacen
// sobre el texto en memoria, nunca sobre el archivo.

const RAIZ = path.resolve(import.meta.dirname, '../../../src');
const leer = (relativa: string) =>
  fs.readFileSync(path.join(RAIZ, relativa), 'utf8');

/** `export const NOMBRE = 200` -> '200'; `undefined` si ya no existe. */
function enteroDeConstante(fuente: string, nombre: string): string | undefined {
  const encontrada = new RegExp(`export const ${nombre}\\s*=\\s*(\\d+)`).exec(
    fuente,
  );
  return encontrada?.[1];
}

/** Los argumentos del `@Roles(...)` que sigue a `@Get('usuarios')`. */
function rolesDeUsuarios(fuente: string): string[] | undefined {
  const encontrada = /@Get\('usuarios'\)\s*@Roles\(([^)]*)\)/.exec(fuente);
  if (encontrada === null) return undefined;
  return [...(encontrada[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

/**
 * Los dos literales de `motivo: <condición> ? 'a' : 'b'` de `registrar`: el
 * primero es el caso "ya no es miembro" y el segundo "tiene rol, pero no basta".
 */
function motivosDeAcceso(
  fuente: string,
): { sinMembresia: string; rolInsuficiente: string } | undefined {
  const encontrada = /motivo:\s*[^?]*\?\s*'([^']+)'\s*:\s*'([^']+)'/.exec(
    fuente,
  );
  if (encontrada === null) return undefined;
  return { sinMembresia: encontrada[1]!, rolInsuficiente: encontrada[2]! };
}

describe('roles de GET /bitacora/usuarios (src/bitacora/bitacora.controller.ts)', () => {
  const controlador = leer('bitacora/bitacora.controller.ts');

  it('el listado de personas lleva exactamente los tres roles de ROLES', () => {
    expect(rolesDeUsuarios(controlador)).toEqual([...ROLES]);
  });

  it('quitar un rol en el backend falla', () => {
    const fuente = controlador.replace(
      "@Get('usuarios')\n  @Roles('admin', 'contador', 'revisor')",
      "@Get('usuarios')\n  @Roles('admin', 'contador')",
    );
    expect(fuente).not.toBe(controlador);
    expect(rolesDeUsuarios(fuente)).not.toEqual([...ROLES]);
  });

  it('quitar el @Roles o la ruta deja de extraerse', () => {
    const sinRoles = controlador.replace(
      "  @Roles('admin', 'contador', 'revisor')\n  @ApiOkResponse({ type: RespuestaUsuariosBitacoraDto })",
      '  @ApiOkResponse({ type: RespuestaUsuariosBitacoraDto })',
    );
    expect(sinRoles).not.toBe(controlador);
    expect(rolesDeUsuarios(sinRoles)).toBeUndefined();

    const sinRuta = controlador.replace("@Get('usuarios')", "@Get('personas')");
    expect(sinRuta).not.toBe(controlador);
    expect(rolesDeUsuarios(sinRuta)).toBeUndefined();
  });
});

describe('motivos de acceso denegado (src/bitacora/accesos-denegados.ts)', () => {
  const fuente = leer('bitacora/accesos-denegados.ts');

  it('MOTIVO_SIN_MEMBRESIA y MOTIVO_ROL_INSUFICIENTE son los literales del backend', () => {
    expect(motivosDeAcceso(fuente)).toEqual({
      sinMembresia: MOTIVO_SIN_MEMBRESIA,
      rolInsuficiente: MOTIVO_ROL_INSUFICIENTE,
    });
  });

  it('un literal renombrado en el backend falla nombrando la constante', () => {
    const renombrado = fuente.replace("'rol_insuficiente'", "'rol_faltante'");
    expect(renombrado).not.toBe(fuente);
    expect(motivosDeAcceso(renombrado)?.rolInsuficiente).not.toBe(
      MOTIVO_ROL_INSUFICIENTE,
    );

    const otraMembresia = fuente.replace("'sin_membresia'", "'no_miembro'");
    expect(otraMembresia).not.toBe(fuente);
    expect(motivosDeAcceso(otraMembresia)?.sinMembresia).not.toBe(
      MOTIVO_SIN_MEMBRESIA,
    );
  });

  it('un literal eliminado del backend deja de extraerse', () => {
    expect(motivosDeAcceso('// vacío')).toBeUndefined();
    const sinCondicion = fuente.replace(/motivo:[^,]*,\n/, '');
    expect(sinCondicion).not.toBe(fuente);
    expect(motivosDeAcceso(sinCondicion)).toBeUndefined();
  });
});

describe('límite de página (src/bandeja/dto/bandeja.dto.ts)', () => {
  const bandeja = leer('bandeja/dto/bandeja.dto.ts');

  it('LIMITE_PAGINA <= LIMITE_MAXIMO del backend', () => {
    const maximo = enteroDeConstante(bandeja, 'LIMITE_MAXIMO');
    expect(maximo).toBeDefined();
    expect(LIMITE_PAGINA).toBe(50);
    expect(LIMITE_PAGINA).toBeLessThanOrEqual(Number(maximo));
  });

  it('bajar LIMITE_MAXIMO por debajo de LIMITE_PAGINA o quitarlo falla', () => {
    const fuente = bandeja.replace('LIMITE_MAXIMO = 200', 'LIMITE_MAXIMO = 20');
    expect(fuente).not.toBe(bandeja);
    expect(LIMITE_PAGINA).toBeGreaterThan(
      Number(enteroDeConstante(fuente, 'LIMITE_MAXIMO')),
    );
    expect(
      enteroDeConstante(
        bandeja.replace(/export const LIMITE_MAXIMO = 200;\n/, ''),
        'LIMITE_MAXIMO',
      ),
    ).toBeUndefined();
  });
});
