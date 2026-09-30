import { leerCfdi } from '../cfdi/lector-cfdi';
import { generarDemo } from '../../scripts/demo/generar';
import { leerCsvDemo, leerDeDisco } from './ayudas-demo';

/**
 * CU-18 (DM-04). Los archivos commiteados se leen con los lectores reales de
 * la aplicación, no con un parser de prueba: si la app los rechazaría, esta
 * prueba falla.
 */

const rutasCfdi = (prefijo: string) =>
  [...generarDemo().keys()].filter((r) =>
    r.startsWith(`demo/cfdi/${prefijo}-`),
  );

describe('demo: los archivos son válidos para los lectores reales (CU-18)', () => {
  it('40 CFDI de FDB y 4 de TCU, todos aceptados por leerCfdi', () => {
    expect(rutasCfdi('fdb')).toHaveLength(40);
    expect(rutasCfdi('tcu')).toHaveLength(4);
    for (const ruta of [...rutasCfdi('fdb'), ...rutasCfdi('tcu')]) {
      expect(() => leerCfdi(leerDeDisco(ruta))).not.toThrow();
    }
  });

  it('UUID únicos y serie-folio únicos, salvo los pares A/B deliberados (S4)', () => {
    const leidos = [...rutasCfdi('fdb'), ...rutasCfdi('tcu')].map((r) =>
      leerCfdi(leerDeDisco(r)),
    );
    expect(new Set(leidos.map((c) => c.uuidFiscal)).size).toBe(leidos.length);
    // Las parejas comparten folio pero no serie: serie+folio sigue siendo único.
    const llaves = leidos.map((c) => `${c.rfcEmisor}|${c.serie}-${c.folio}`);
    expect(new Set(llaves).size).toBe(llaves.length);
    const folios = leidos.filter((c) => c.rfcEmisor === 'FDB190215QK4');
    const repetidos = folios.filter(
      (c) => folios.filter((o) => o.folio === c.folio).length > 1,
    );
    expect(new Set(repetidos.map((c) => c.folio))).toEqual(
      new Set(['2001', '2002', '2003']),
    );
  });

  it('CFDI de FDB: 38 PUE en MXN, 1 PPD y 1 USD', () => {
    const fdb = rutasCfdi('fdb').map((r) => leerCfdi(leerDeDisco(r)));
    expect(fdb.filter((c) => c.metodoPago === 'PPD')).toHaveLength(1);
    expect(fdb.filter((c) => c.moneda === 'USD')).toHaveLength(1);
    expect(
      fdb.filter((c) => c.estadoInicial === 'abierta' && c.moneda === 'MXN'),
    ).toHaveLength(38);
  });

  it('estados de cuenta: 45 + 5 movimientos de FDB y 5 de TCU, con el perfil cuadra', () => {
    expect(leerCsvDemo(leerDeDisco('demo/estado-cuenta-1.csv'))).toHaveLength(
      45,
    );
    expect(leerCsvDemo(leerDeDisco('demo/estado-cuenta-2.csv'))).toHaveLength(
      5,
    );
    expect(leerCsvDemo(leerDeDisco('demo/estado-cuenta-tcu.csv'))).toHaveLength(
      5,
    );
  });

  it('42 abonos y 8 cargos en FDB; fechas dentro de agosto-septiembre de 2026', () => {
    const filas = [1, 2].flatMap((n) =>
      leerCsvDemo(leerDeDisco(`demo/estado-cuenta-${n}.csv`)),
    );
    expect(filas.filter((f) => !f.monto.startsWith('-'))).toHaveLength(42);
    expect(filas.filter((f) => f.monto.startsWith('-'))).toHaveLength(8);
    for (const f of filas) {
      expect(f.fecha >= '2026-08-03' && f.fecha <= '2026-09-30').toBe(true);
    }
  });

  it('los CSV van en UTF-8 sin BOM, con LF y línea final', () => {
    for (const n of ['1', '2', 'tcu']) {
      const texto = leerDeDisco(`demo/estado-cuenta-${n}.csv`);
      expect(texto.charCodeAt(0)).not.toBe(0xfeff);
      expect(texto).not.toContain('\r');
      expect(texto.endsWith('\n')).toBe(true);
    }
  });
});
