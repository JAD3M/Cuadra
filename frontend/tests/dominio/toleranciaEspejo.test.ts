// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCION_ACTUALIZAR,
  CAMPO_TOLERANCIA,
  DECIMALES_TOLERANCIA,
  ENTIDAD_EMPRESA,
  PATRON_TOLERANCIA,
  ROLES_QUE_EDITAN_TOLERANCIA,
  TOLERANCIA_MAXIMA,
} from '@/shared/dominio';
import {
  CAMBIOS_VISIBLES,
  LIMITE_CONSULTA_CAMBIOS,
} from '@/features/tolerancia/constantes';

// Deriva de los espejos de tolerancia (CU-25) contra el backend. Mismo
// patrón que cargasEspejo.test.ts: el espejo coincide con el código, y
// cambiar el código allá (o quitar la constante) hace fallar la comprobación
// nombrando la constante. Solo LEE archivos del backend.

const RAIZ = path.resolve(import.meta.dirname, '../../../src');
const leer = (relativa: string) =>
  fs.readFileSync(path.join(RAIZ, relativa), 'utf8');

/** `export const NOMBRE = '100'` -> '100'; `undefined` si ya no existe. */
function textoDeConstante(fuente: string, nombre: string): string | undefined {
  const encontrada = new RegExp(
    `export const ${nombre}\\s*=\\s*'([^']*)'`,
  ).exec(fuente);
  return encontrada?.[1];
}

/** `export const NOMBRE = 200` -> '200'; `undefined` si ya no existe. */
function enteroDeConstante(fuente: string, nombre: string): string | undefined {
  const encontrada = new RegExp(`export const ${nombre}\\s*=\\s*(\\d+)`).exec(
    fuente,
  );
  return encontrada?.[1];
}

/** La fuente del regex literal `/^\d+(\.\d{1,N})?$/` que valida el DTO. */
function patronDelDto(fuente: string): string | undefined {
  const encontrada = /\/(\^\\d\+[^/\n]*\$)\/\.test\(/.exec(fuente);
  return encontrada?.[1];
}

/** Los argumentos del `@Roles(...)` que precede al método `actualizar`. */
function rolesDelPut(fuente: string): string[] | undefined {
  const encontrada =
    /@Put\('tolerancia'\)\s*@Roles\(([^)]*)\)\s*async actualizar/.exec(fuente);
  if (encontrada === null) return undefined;
  return [...(encontrada[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

/** Los literales `entidad`, `accion` y `campo` que audita el servicio. */
function literalesDeBitacora(fuente: string): {
  entidad?: string;
  accion?: string;
  campo?: string;
} {
  const tomar = (clave: string) =>
    new RegExp(`${clave}:\\s*'([^']+)'`).exec(fuente)?.[1];
  return {
    entidad: tomar('entidad'),
    accion: tomar('accion'),
    campo: tomar('campo'),
  };
}

describe('tolerancia del DTO (src/companies/dto/tolerancia.dto.ts)', () => {
  const dto = leer('companies/dto/tolerancia.dto.ts');

  it('TOLERANCIA_MAXIMA coincide con el tope del backend', () => {
    expect(textoDeConstante(dto, 'TOLERANCIA_MAXIMA')).toBe(TOLERANCIA_MAXIMA);
  });

  it('PATRON_TOLERANCIA es el regex del DTO y DECIMALES_TOLERANCIA su tope', () => {
    const fuente = patronDelDto(dto);
    expect(fuente).toBeDefined();
    expect(PATRON_TOLERANCIA.source).toBe(fuente);
    expect(fuente).toContain(`{1,${DECIMALES_TOLERANCIA}}`);
  });

  it('cambiar el tope o el patrón en el backend falla nombrando la constante', () => {
    const otroTope = dto.replace(
      "TOLERANCIA_MAXIMA = '100'",
      "TOLERANCIA_MAXIMA = '1000'",
    );
    expect(otroTope).not.toBe(dto);
    expect(textoDeConstante(otroTope, 'TOLERANCIA_MAXIMA')).not.toBe(
      TOLERANCIA_MAXIMA,
    );

    const otroPatron = dto.replace('{1,4}', '{1,6}');
    expect(otroPatron).not.toBe(dto);
    expect(patronDelDto(otroPatron)).not.toBe(PATRON_TOLERANCIA.source);
  });

  it('una constante eliminada del backend deja de extraerse', () => {
    const sinTope = dto.replace(
      /export const TOLERANCIA_MAXIMA = '100';\n/,
      '',
    );
    expect(sinTope).not.toBe(dto);
    expect(textoDeConstante(sinTope, 'TOLERANCIA_MAXIMA')).toBeUndefined();
    expect(patronDelDto('// vacío')).toBeUndefined();
  });
});

describe('roles que editan (@Roles del PUT de src/companies/empresa.controller.ts)', () => {
  const controlador = leer('companies/empresa.controller.ts');

  it('el PUT lleva exactamente ROLES_QUE_EDITAN_TOLERANCIA', () => {
    expect(rolesDelPut(controlador)).toEqual([...ROLES_QUE_EDITAN_TOLERANCIA]);
  });

  it('ampliar el rol en el backend falla', () => {
    const fuente = controlador.replace(
      "@Roles('admin')",
      "@Roles('admin', 'contador')",
    );
    expect(fuente).not.toBe(controlador);
    expect(rolesDelPut(fuente)).not.toEqual([...ROLES_QUE_EDITAN_TOLERANCIA]);
  });

  it('quitar el @Roles del PUT deja de extraerse', () => {
    const fuente = controlador.replace("  @Roles('admin')\n", '');
    expect(fuente).not.toBe(controlador);
    expect(rolesDelPut(fuente)).toBeUndefined();
  });
});

describe('literales de la bitácora (src/companies/tolerancia.service.ts)', () => {
  const servicio = leer('companies/tolerancia.service.ts');

  it('entidad, acción y campo coinciden con los espejos', () => {
    expect(literalesDeBitacora(servicio)).toEqual({
      entidad: ENTIDAD_EMPRESA,
      accion: ACCION_ACTUALIZAR,
      campo: CAMPO_TOLERANCIA,
    });
  });

  it('un literal renombrado en el backend falla nombrando la constante', () => {
    const fuente = servicio.replace(
      "campo: 'tolerancia_monto'",
      "campo: 'tolerancia'",
    );
    expect(fuente).not.toBe(servicio);
    expect(literalesDeBitacora(fuente).campo).not.toBe(CAMPO_TOLERANCIA);

    const otraEntidad = servicio.replace(
      "entidad: 'companies'",
      "entidad: 'empresas'",
    );
    expect(otraEntidad).not.toBe(servicio);
    expect(literalesDeBitacora(otraEntidad).entidad).not.toBe(ENTIDAD_EMPRESA);
  });

  it('un literal eliminado del backend deja de extraerse', () => {
    expect(literalesDeBitacora('// vacío').accion).toBeUndefined();
  });
});

describe('límite de consulta (src/bandeja/dto/bandeja.dto.ts)', () => {
  const bandeja = leer('bandeja/dto/bandeja.dto.ts');

  it('CAMBIOS_VISIBLES <= LIMITE_CONSULTA_CAMBIOS <= LIMITE_MAXIMO', () => {
    const maximo = enteroDeConstante(bandeja, 'LIMITE_MAXIMO');
    expect(maximo).toBeDefined();
    expect(CAMBIOS_VISIBLES).toBe(5);
    expect(LIMITE_CONSULTA_CAMBIOS).toBe(50);
    expect(CAMBIOS_VISIBLES).toBeLessThanOrEqual(LIMITE_CONSULTA_CAMBIOS);
    expect(LIMITE_CONSULTA_CAMBIOS).toBeLessThanOrEqual(Number(maximo));
  });

  it('bajar LIMITE_MAXIMO por debajo de nuestro límite o quitarlo falla', () => {
    const fuente = bandeja.replace('LIMITE_MAXIMO = 200', 'LIMITE_MAXIMO = 20');
    expect(fuente).not.toBe(bandeja);
    expect(LIMITE_CONSULTA_CAMBIOS).toBeGreaterThan(
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
