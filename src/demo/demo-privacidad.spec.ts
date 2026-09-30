import { leerCfdi } from '../cfdi/lector-cfdi';
import {
  PREFIJOS_DESCRIPCION,
  RFC_RECEPTORES,
} from '../../scripts/demo/escenarios';
import { RFC_EMPRESA, RFC_PAC } from '../../scripts/demo/formatos';
import { generarDemo } from '../../scripts/demo/generar';
import { leerCsvDemo, leerDeDisco } from './ayudas-demo';

/**
 * CU-18 (DM-08). Nada de la demo puede parecer un dato real: solo RFC de una
 * lista cerrada, nombres marcados "(sintético)", sellos de relleno y textos
 * bancarios de plantilla. Lo que no esté en las listas hace fallar la prueba.
 */

const RUTAS = [...generarDemo().keys()];
const XML = RUTAS.filter((r) => r.endsWith('.xml'));
const CSV = RUTAS.filter((r) => r.endsWith('.csv'));
const UUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g;

describe('demo: sin datos reales (CU-18)', () => {
  it('todo RFC está en la lista cerrada de la demo', () => {
    const permitidos = new Set([
      ...Object.values(RFC_EMPRESA),
      RFC_PAC,
      ...RFC_RECEPTORES,
    ]);
    for (const ruta of XML) {
      const c = leerCfdi(leerDeDisco(ruta));
      expect(permitidos.has(c.rfcEmisor)).toBe(true);
      expect(permitidos.has(c.rfcReceptor)).toBe(true);
    }
    for (const ruta of RUTAS) {
      const crudos = leerDeDisco(ruta).match(
        /\b[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}\b/g,
      );
      for (const rfc of crudos ?? []) expect(permitidos.has(rfc)).toBe(true);
    }
  });

  it('todo Nombre termina en "(sintético)" y los sellos son de relleno', () => {
    for (const ruta of XML) {
      const xml = leerDeDisco(ruta);
      const nombres = [...xml.matchAll(/\bNombre="([^"]*)"/g)].map((m) => m[1]);
      expect(nombres).toHaveLength(2);
      for (const nombre of nombres) expect(nombre).toMatch(/\(sintético\)$/);
      for (const sello of ['Sello', 'SelloCFD', 'SelloSAT']) {
        expect(xml).toContain(`${sello}="SINTETICO"`);
      }
      expect(xml).toContain('SINTETICO: datos inventados');
    }
  });

  it('las descripciones de los CSV salen de las plantillas y del alfabeto bancario', () => {
    for (const ruta of CSV) {
      for (const fila of leerCsvDemo(leerDeDisco(ruta))) {
        expect(fila.descripcion).toMatch(/^[A-Z0-9 -]+$/);
        expect(
          PREFIJOS_DESCRIPCION.some((p) => fila.descripcion.startsWith(p)),
        ).toBe(true);
        expect(fila.referencia ?? '').toMatch(/^[A-Z0-9 -]*$/);
      }
    }
  });

  it('sin correos, teléfonos, CLABE, CURP ni números largos', () => {
    for (const ruta of RUTAS) {
      const texto = leerDeDisco(ruta).replace(UUID, '');
      expect(texto).not.toContain('@');
      // 10 o más dígitos seguidos: teléfono, CLABE (18), tarjeta, cuenta.
      expect(texto).not.toMatch(/\d{10,}/);
      // CURP: 4 letras, AAMMDD, H/M, 5 letras, 2 alfanuméricos.
      expect(texto).not.toMatch(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]{2}/);
    }
  });
});
