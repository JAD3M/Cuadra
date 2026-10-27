// src/bancos/perfil.ts
import { readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { z } from 'zod';

/**
 * CU-10: cómo leer el estado de cuenta de un banco. Solo datos: nada de
 * funciones, eval ni regex en el JSON. Agregar un banco es agregar un
 * archivo a `src/bancos/perfiles/`; el código no cambia.
 */

const nombreDeColumna = z.string().min(1).max(128);

export const esquemaPerfil = z
  .object({
    /** Igual al nombre del archivo sin `.json`; es lo que manda el POST. */
    id: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'minúsculas, dígitos y guiones'),
    nombre: z.string().min(1).max(128),
    /** Con TextDecoder nativo, sin dependencias. */
    codificacion: z.enum(['utf-8', 'windows-1252']),
    separador: z.enum([',', ';', '\t']),
    /** Líneas físicas antes del encabezado (datos de la cuenta, etc.). */
    lineasPreambulo: z.number().int().min(0).max(100),
    /**
     * La fila de encabezados completa, exacta y en orden, incluidas las
     * columnas que no se usan (el saldo, por ejemplo). Si el banco cambia su
     * formato, el archivo se rechaza en vez de leerse mal.
     */
    encabezados: z.array(nombreDeColumna).min(1),
    /** Qué encabezado es cada dato. Monto con signo, o cargo + abono. */
    columnas: z
      .object({
        fecha: nombreDeColumna,
        concepto: nombreDeColumna,
        referencia: nombreDeColumna.optional(),
        monto: nombreDeColumna.optional(),
        cargo: nombreDeColumna.optional(),
        abono: nombreDeColumna.optional(),
      })
      .strict(),
    /**
     * Historia 3.1: encabezado de una columna `moneda` OPCIONAL. No va en
     * `encabezados` (que son los obligatorios): si el archivo la trae, en
     * cualquier posición, toda fila debe decir MXN o ir vacía; si no, se
     * asume MXN.
     */
    columnaMoneda: nombreDeColumna.optional(),
    formatoFecha: z.enum(['AAAA-MM-DD', 'DD/MM/AAAA', 'DD-MM-AAAA']),
    separadorMiles: z.enum([',', '.']).nullable(),
    separadorDecimal: z.enum(['.', ',']),
  })
  // Una llave de más suele ser un typo ("separadorMil"), y en silencio se
  // perdería.
  .strict()
  .superRefine((perfil, ctx) => {
    const { columnas, encabezados } = perfil;
    const conMonto = columnas.monto !== undefined;
    const conCargo = columnas.cargo !== undefined;
    const conAbono = columnas.abono !== undefined;
    if (conMonto === (conCargo || conAbono) || conCargo !== conAbono) {
      ctx.addIssue({
        code: 'custom',
        path: ['columnas'],
        message: 'Declara "monto" (con signo), o "cargo" y "abono"; no ambos',
      });
    }
    if (perfil.separadorMiles === perfil.separadorDecimal) {
      ctx.addIssue({
        code: 'custom',
        path: ['separadorMiles'],
        message: 'El separador de miles no puede ser igual al decimal',
      });
    }
    if (new Set(encabezados).size !== encabezados.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['encabezados'],
        message: 'Hay encabezados repetidos',
      });
    }
    if (
      perfil.columnaMoneda !== undefined &&
      encabezados.includes(perfil.columnaMoneda)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['columnaMoneda'],
        message: 'Es opcional: no puede estar también en "encabezados"',
      });
    }
    for (const [dato, encabezado] of Object.entries(columnas)) {
      if (encabezado !== undefined && !encabezados.includes(encabezado)) {
        ctx.addIssue({
          code: 'custom',
          path: ['columnas', dato],
          message: `"${encabezado}" no está en "encabezados"`,
        });
      }
    }
  });

export type PerfilBancario = z.infer<typeof esquemaPerfil>;

/**
 * Todos los `*.json` del directorio, validados. Cualquier problema lanza,
 * con el archivo y el campo: la api no arranca con un perfil inválido. Un
 * perfil que no carga es un banco que no se puede leer, y eso se tiene que
 * ver en el despliegue, no en la primera carga de un contador.
 */
export function cargarPerfiles(directorio: string): PerfilBancario[] {
  const archivos = readdirSync(directorio)
    .filter((archivo) => archivo.endsWith('.json'))
    .sort();
  if (archivos.length === 0) {
    throw new Error(`No hay perfiles de banco en ${directorio}`);
  }
  return archivos.map((archivo) => {
    let crudo: unknown;
    try {
      crudo = JSON.parse(readFileSync(join(directorio, archivo), 'utf8'));
    } catch (error) {
      throw new Error(
        `Perfil de banco ${archivo}: JSON inválido (${(error as Error).message})`,
      );
    }
    const resultado = esquemaPerfil.safeParse(crudo);
    if (!resultado.success) {
      const problemas = resultado.error.issues
        .map((i) => `  ${i.path.join('.') || '(raíz)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Perfil de banco ${archivo} inválido:\n${problemas}`);
    }
    const perfil = resultado.data;
    if (perfil.id !== basename(archivo, '.json')) {
      throw new Error(
        `Perfil de banco ${archivo}: el id "${perfil.id}" debe ser igual al nombre del archivo`,
      );
    }
    return perfil;
  });
}
