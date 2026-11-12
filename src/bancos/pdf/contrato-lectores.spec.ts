import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  BANCOS_DE_PRUEBA,
  lineasDeEstadoCuenta,
  MES_DE_PRUEBA,
  type EstadoDeCuentaDePrueba,
} from '../../testing/estados-de-cuenta-de-prueba';
import { EstadoDeCuentaRechazado } from '../lector-estado-cuenta';
import { BANCOS_PDF, lectorPdfDe } from './lectores-pdf';

/**
 * Historia 8.3. Contrato común de los lectores de PDF (AD-8): cada banco
 * devuelve la misma forma, normaliza igual y rechaza igual, y ninguno hace su
 * propio cuadre. Un banco nuevo entra a `BANCOS_DE_PRUEBA` o esta prueba falla.
 * SINTÉTICO: los textos los arma `estados-de-cuenta-de-prueba.ts`.
 */

const leer = (banco: string, estado: EstadoDeCuentaDePrueba) => {
  const lector = lectorPdfDe(banco);
  if (!lector) throw new Error(`sin lector para ${banco}`);
  return lector(lineasDeEstadoCuenta(banco as never, estado).join('\n'));
};

describe('contrato de los lectores de PDF', () => {
  it('cada banco registrado tiene su caso de contrato, y al revés', () => {
    expect([...BANCOS_DE_PRUEBA].sort()).toEqual([...BANCOS_PDF].sort());
  });

  describe.each(BANCOS_DE_PRUEBA)('%s', (banco) => {
    it('devuelve la misma forma de datos', () => {
      const r = leer(banco, MES_DE_PRUEBA);
      expect(Object.keys(r).sort()).toEqual([
        'lineasNoLeidas',
        'movimientos',
        'saldoFinal',
        'saldoInicial',
      ]);
      expect(r.saldoInicial).toMatch(/^-?\d+\.\d{2}$/);
      expect(r.saldoFinal).toMatch(/^-?\d+\.\d{2}$/);
      expect(r.lineasNoLeidas).toEqual([]);
      for (const m of r.movimientos) {
        expect(Object.keys(m).sort()).toEqual([
          'descripcion',
          'fecha',
          'monto',
          'referencia',
        ]);
        expect(m.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(m.monto).toMatch(/^-?\d+\.\d{2}$/);
        expect(m.referencia === null || typeof m.referencia === 'string').toBe(
          true,
        );
      }
    });

    it('normaliza el mismo mes a los mismos movimientos que los demás bancos', () => {
      const r = leer(banco, MES_DE_PRUEBA);
      expect(r.saldoInicial).toBe('10000.00');
      expect(r.saldoFinal).toBe('11000.50');
      expect(r.movimientos).toEqual(
        MES_DE_PRUEBA.movimientos.map((m) => ({
          fecha: m.fecha,
          descripcion: m.descripcion,
          referencia: m.referencia === '' ? null : m.referencia,
          monto: m.monto,
        })),
      );
    });

    it('rechaza una moneda distinta de MXN con el mismo código', () => {
      expect(() => leer(banco, { ...MES_DE_PRUEBA, moneda: 'USD' })).toThrow(
        expect.objectContaining({ codigo: 'moneda_no_mxn' }) as Error,
      );
    });

    it('rechaza un texto que no es su estado de cuenta, con un rechazo del dominio', () => {
      const lector = lectorPdfDe(banco)!;
      expect(() => lector('esto no es un estado de cuenta')).toThrow(
        EstadoDeCuentaRechazado,
      );
    });

    it('no adivina: un importe que no cuadra con el saldo corrido es línea no leída', () => {
      const movimientos = [...MES_DE_PRUEBA.movimientos];
      const lineas = lineasDeEstadoCuenta(banco, {
        ...MES_DE_PRUEBA,
        movimientos,
      });
      // Cambia el importe de la primera línea de movimiento, no su saldo.
      const i = lineas.findIndex((l) => l.includes('PAGO PROVEEDOR'));
      lineas[i] = lineas[i].replace('2,000.00', '1,999.00');
      const r = lectorPdfDe(banco)!(lineas.join('\n'));
      expect(r.lineasNoLeidas.map((l) => l.texto)).toContain(lineas[i]);
      expect(r.movimientos).toEqual([]);
    });
  });
});

describe('una sola función de cuadre (AD-8)', () => {
  const raiz = join(__dirname, '..', '..');

  function fuentes(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) return fuentes(ruta);
      return ruta.endsWith('.ts') &&
        !/\.(spec|integracion\.spec)\.ts$/.test(ruta)
        ? [ruta]
        : [];
    });
  }

  const importa = (ruta: string) =>
    /from\s+['"][^'"]*cuadre-saldos['"]/.test(readFileSync(ruta, 'utf8'));

  it('ningún lector de banco importa el cuadre: lo hace el servicio, una vez', () => {
    const lectores = fuentes(join(raiz, 'bancos', 'pdf'));
    expect(lectores.filter(importa)).toEqual([]);
  });

  it('el cuadre solo lo importa el servicio de cargas', () => {
    const quienes = fuentes(raiz)
      .filter(importa)
      .map((r) => relative(raiz, r));
    expect(quienes).toEqual([join('cargas', 'cargas.service.ts')]);
  });
});
