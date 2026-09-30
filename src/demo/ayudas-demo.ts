import { readFileSync } from 'fs';
import { join } from 'path';
import {
  leerFilas,
  leerMovimiento,
  validarEstadoDeCuenta,
} from '../bancos/lector-estado-cuenta';
import { cargarPerfiles } from '../bancos/perfil';
import { DIRECTORIO_PERFILES } from '../bancos/perfiles-bancarios';

/** Apoyo de las guardas de la demo: lee CSV con el lector real del perfil `cuadra`. */

export const RAIZ = join(__dirname, '..', '..');

export const PERFIL_CUADRA = cargarPerfiles(DIRECTORIO_PERFILES).find(
  (p) => p.id === 'cuadra',
)!;

export function leerDeDisco(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), 'utf8');
}

export interface FilaDemo {
  fecha: string;
  descripcion: string;
  referencia: string | null;
  monto: string;
}

/** Valida el archivo completo y lee cada fila; una fila con motivo hace fallar. */
export function leerCsvDemo(texto: string): FilaDemo[] {
  const { filas } = validarEstadoDeCuenta(
    Buffer.from(texto, 'utf8'),
    PERFIL_CUADRA,
  );
  const [, ...datos] = leerFilas(texto, PERFIL_CUADRA);
  if (datos.length !== filas) throw new Error('El conteo de filas no cuadra');
  return datos.map((fila) => {
    const leida = leerMovimiento(fila.campos, PERFIL_CUADRA);
    if ('motivo' in leida) {
      throw new Error(`Línea ${fila.linea}: ${leida.motivo}`);
    }
    return leida;
  });
}
