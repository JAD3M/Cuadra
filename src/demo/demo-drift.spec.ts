import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { generarDemo } from '../../scripts/demo/generar';
import { leerDeDisco, RAIZ } from './ayudas-demo';

/**
 * CU-18 (DM-07). Lo commiteado en demo/ es exactamente lo que genera el
 * generador: cualquier edición a mano o cambio del generador sin regenerar
 * falla aquí con la lista de archivos. Se regenera con `npm run demo:generar`.
 */

const normalizar = (texto: string) => texto.replace(/\r\n/g, '\n');

function archivosEnDisco(): string[] {
  const cfdi = readdirSync(join(RAIZ, 'demo', 'cfdi')).map(
    (n) => `demo/cfdi/${n}`,
  );
  const csv = readdirSync(join(RAIZ, 'demo'))
    .filter((n) => n.endsWith('.csv'))
    .map((n) => `demo/${n}`);
  return [...cfdi, ...csv].sort();
}

describe('demo: sin deriva entre generador y archivos (CU-18)', () => {
  const generados = generarDemo();

  it('dos corridas dan los mismos bytes', () => {
    expect([...generarDemo()]).toEqual([...generados]);
  });

  it('no faltan ni sobran archivos', () => {
    const esperados = [...generados.keys()].sort();
    expect({
      faltan: esperados.filter((r) => !existsSync(join(RAIZ, r))),
      sobran: archivosEnDisco().filter((r) => !generados.has(r)),
    }).toEqual({ faltan: [], sobran: [] });
  });

  it('cada archivo commiteado es idéntico a la salida del generador', () => {
    const distintos = [...generados]
      .filter(
        ([ruta, contenido]) =>
          !existsSync(join(RAIZ, ruta)) ||
          normalizar(leerDeDisco(ruta)) !== normalizar(contenido),
      )
      .map(([ruta]) => ruta);
    expect(distintos).toEqual([]);
  });
});
