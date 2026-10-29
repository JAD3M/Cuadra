// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { permisosDelControlador, rolesDeMatriz } from './extraerPermisos';
import {
  LIMITES_CARGA,
  PERFIL_POR_DEFECTO,
  RESULTADOS_ARCHIVO,
  RESULTADO_ERROR,
  rolesConPermiso,
} from '@/shared/dominio';
import {
  constantesNumericas,
  extensionDelGuard,
  maxLengthPorPropiedad,
  perfilPorDefecto,
  resultadosDeArchivo,
  resultadosDeFila,
} from './extraerCargas';

// Deriva de los espejos de cargas (CU-24, M9) contra el backend. Mismo
// patrón que reglas.test.ts: el espejo coincide con el código, y cambiar el
// código allá (o quitar la constante) hace fallar la comprobación.

const RAIZ = path.resolve(import.meta.dirname, '../../../src');
const leer = (relativa: string) =>
  fs.readFileSync(path.join(RAIZ, relativa), 'utf8');

describe('resultados de la carga (src/cargas/carga.entity.ts)', () => {
  const entidad = leer('cargas/carga.entity.ts');

  it('RESULTADOS_ARCHIVO coincide con ResultadoDeArchivo', () => {
    expect(resultadosDeArchivo(entidad)).toEqual([...RESULTADOS_ARCHIVO]);
  });

  it('RESULTADO_ERROR es el resultado de ResultadoDeFila y de un archivo con error', () => {
    expect(resultadosDeFila(entidad)).toEqual([RESULTADO_ERROR]);
    expect(RESULTADOS_ARCHIVO).toContain(RESULTADO_ERROR);
  });

  it('un literal renombrado en el backend falla nombrando la constante', () => {
    const fuente = entidad.replace("'ya_existia'", "'ya_estaba'");
    expect(fuente).not.toBe(entidad);
    expect(
      `RESULTADOS_ARCHIVO: ${JSON.stringify(resultadosDeArchivo(fuente))}`,
    ).not.toBe(
      `RESULTADOS_ARCHIVO: ${JSON.stringify([...RESULTADOS_ARCHIVO])}`,
    );
    expect(resultadosDeArchivo(fuente)).not.toEqual([...RESULTADOS_ARCHIVO]);
  });

  it('si el backend deja de declarar los tipos, la extracción no encuentra nada', () => {
    expect(resultadosDeArchivo('// vacío')).toBeUndefined();
    expect(resultadosDeFila('// vacío')).toBeUndefined();
  });
});

describe('roles que cargan (@Permiso de src/cargas/cargas.controller.ts)', () => {
  const controlador = leer('cargas/cargas.controller.ts');
  const matriz = leer('auth/permisos/matriz.ts');

  it('los cinco POST declaran cargas.cargar y la matriz del backend coincide con el espejo', () => {
    // CFDI, estado de cuenta, PDF, aceptar y rechazar la vista previa.
    expect(
      permisosDelControlador(controlador).filter((p) => p !== 'cargas.ver'),
    ).toEqual(Array(5).fill('cargas.cargar'));
    expect(rolesDeMatriz(matriz, 'cargas.cargar')).toEqual([
      ...rolesConPermiso('cargas.cargar'),
    ]);
  });

  it('agregar un rol en la matriz falla', () => {
    const fuente = matriz.replace(
      "'cargas.cargar': ['admin', 'contador']",
      "'cargas.cargar': ['admin', 'contador', 'revisor']",
    );
    expect(fuente).not.toBe(matriz);
    expect(rolesDeMatriz(fuente, 'cargas.cargar')).not.toEqual([
      ...rolesConPermiso('cargas.cargar'),
    ]);
  });
});

describe('perfil por defecto (src/bancos/perfiles-bancarios.ts)', () => {
  const texto = leer('bancos/perfiles-bancarios.ts');

  it('el espejo coincide con el backend', () => {
    expect(perfilPorDefecto(texto)).toBe(PERFIL_POR_DEFECTO);
  });

  it('cambiar el valor o quitar la constante falla', () => {
    const cambiado = texto.replace("'cuadra'", "'otro'");
    expect(cambiado).not.toBe(texto);
    expect(perfilPorDefecto(cambiado)).not.toBe(PERFIL_POR_DEFECTO);
    expect(perfilPorDefecto('// vacío')).toBeUndefined();
  });
});

describe('límites de carga (src/cargas/archivos.guard.ts y estado-cuenta.dto.ts)', () => {
  const guard = leer('cargas/archivos.guard.ts');
  const dto = leer('cargas/dto/estado-cuenta.dto.ts');
  const MB = 1024 * 1024;

  it('el evaluador numérico resuelve `2 * MB` y las constantes del guard', () => {
    const c = constantesNumericas(guard);
    expect(c.MB).toBe(MB);
    expect(c.MAX_BYTES_POR_ARCHIVO).toBe(2 * MB);
    expect(c.MAX_BYTES_POR_PETICION).toBe(50 * MB);
  });

  it('CFDI: cantidad, bytes por archivo, bytes totales y extensión', () => {
    const c = constantesNumericas(guard);
    expect(LIMITES_CARGA.cfdi.maxArchivos).toBe(c.MAX_ARCHIVOS);
    expect(LIMITES_CARGA.cfdi.maxBytesPorArchivo).toBe(c.MAX_BYTES_POR_ARCHIVO);
    expect(LIMITES_CARGA.cfdi.maxBytesTotal).toBe(c.MAX_BYTES_POR_PETICION);
    expect(LIMITES_CARGA.cfdi.extension).toBe(
      extensionDelGuard(guard, 'ArchivosXmlGuard'),
    );
  });

  it('estado de cuenta: bytes del CSV y extensión', () => {
    const c = constantesNumericas(guard);
    expect(LIMITES_CARGA.estadoCuenta.maxBytesPorArchivo).toBe(
      c.MAX_BYTES_ESTADO_CUENTA,
    );
    expect(LIMITES_CARGA.estadoCuenta.extension).toBe(
      extensionDelGuard(guard, 'EstadoDeCuentaGuard'),
    );
  });

  it('banco y cuenta: @MaxLength del DTO', () => {
    const largos = maxLengthPorPropiedad(dto);
    expect(LIMITES_CARGA.estadoCuenta.maxBanco).toBe(largos.banco);
    expect(LIMITES_CARGA.estadoCuenta.maxCuenta).toBe(largos.cuenta);
  });

  it('cambiar un límite en el backend falla nombrando la constante', () => {
    const fuente = guard.replace(
      'MAX_BYTES_POR_ARCHIVO = 2 * MB',
      'MAX_BYTES_POR_ARCHIVO = 3 * MB',
    );
    expect(fuente).not.toBe(guard);
    expect(constantesNumericas(fuente).MAX_BYTES_POR_ARCHIVO).not.toBe(
      LIMITES_CARGA.cfdi.maxBytesPorArchivo,
    );
  });

  it('una constante eliminada del backend deja de extraerse', () => {
    const fuente = guard.replace(/export const MAX_ARCHIVOS = 500;\n/, '');
    expect(fuente).not.toBe(guard);
    expect(constantesNumericas(fuente).MAX_ARCHIVOS).toBeUndefined();
  });

  it('cambiar la extensión o un @MaxLength falla', () => {
    const otraExtension = guard.replace(
      "extension: '.xml',",
      "extension: '.json',",
    );
    expect(extensionDelGuard(otraExtension, 'ArchivosXmlGuard')).not.toBe(
      LIMITES_CARGA.cfdi.extension,
    );
    const otroLargo = dto.replace('@MaxLength(32)', '@MaxLength(40)');
    expect(otroLargo).not.toBe(dto);
    expect(maxLengthPorPropiedad(otroLargo).cuenta).not.toBe(
      LIMITES_CARGA.estadoCuenta.maxCuenta,
    );
  });
});
