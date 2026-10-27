import {
  CODIGO_MONEDA_NO_MXN,
  EstadoDeCuentaRechazado,
} from '../lector-estado-cuenta';
import { leerEstadoCuentaBbva } from './lector-bbva';

// SINTÉTICO: textos de ejemplo, no son de un estado de cuenta real.
const ENCABEZADO = [
  'Periodo DEL 01/10/2026 AL 31/10/2026',
  'Moneda MXN',
  'Saldo Anterior 10,000.00',
  'Saldo Final 11,250.50',
];

function texto(...lineas: string[]): string {
  return [...ENCABEZADO, ...lineas].join('\n');
}

describe('leerEstadoCuentaBbva', () => {
  it('lee saldos y movimientos de un estado de cuenta completo', () => {
    const r = leerEstadoCuentaBbva(
      texto(
        '02/OCT 02/OCT PAGO PROVEEDOR 2,000.00 8,000.00',
        '15/OCT 15/OCT DEPOSITO CLIENTE 3,250.50 11,250.50',
      ),
    );
    expect(r.saldoInicial).toBe('10000.00');
    expect(r.saldoFinal).toBe('11250.50');
    expect(r.movimientos).toHaveLength(2);
    expect(r.lineasNoLeidas).toEqual([]);
  });

  it('deduce el signo del saldo corrido: cargo negativo, abono positivo', () => {
    const r = leerEstadoCuentaBbva(
      texto(
        '02/OCT 02/OCT PAGO PROVEEDOR 250.00 9,750.00',
        '03/OCT 03/OCT DEPOSITO 1,000.00 10,750.00',
      ),
    );
    expect(r.movimientos.map((m) => m.monto)).toEqual(['-250.00', '1000.00']);
    expect(r.movimientos[0]).toEqual({
      fecha: '2026-10-02',
      descripcion: 'PAGO PROVEEDOR',
      referencia: null,
      monto: '-250.00',
    });
  });

  it('manda a lineasNoLeidas la línea cuyo importe no cuadra con el saldo, sin adivinar el signo', () => {
    const linea = '02/OCT 02/OCT PAGO RARO 250.00 9,000.00';
    const r = leerEstadoCuentaBbva(texto(linea));
    expect(r.movimientos).toEqual([]);
    expect(r.lineasNoLeidas).toEqual([{ linea: 5, texto: linea }]);
  });

  it('manda a lineasNoLeidas una línea desconocida y sigue con las demás', () => {
    const r = leerEstadoCuentaBbva(
      texto(
        'texto basura que no es un movimiento',
        '02/OCT 02/OCT PAGO 250.00 9,750.00',
      ),
    );
    expect(r.movimientos).toHaveLength(1);
    expect(r.lineasNoLeidas).toEqual([
      { linea: 5, texto: 'texto basura que no es un movimiento' },
    ]);
  });

  it('manda a lineasNoLeidas una fecha que no existe', () => {
    const r = leerEstadoCuentaBbva(texto('31/FEB 31/FEB PAGO 250.00 9,750.00'));
    expect(r.movimientos).toEqual([]);
    expect(r.lineasNoLeidas).toHaveLength(1);
  });

  it('rechaza con moneda_no_mxn si la moneda no es MXN', () => {
    const t = texto().replace('Moneda MXN', 'Moneda USD');
    let error: unknown;
    try {
      leerEstadoCuentaBbva(t);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EstadoDeCuentaRechazado);
    expect((error as EstadoDeCuentaRechazado).codigo).toBe(
      CODIGO_MONEDA_NO_MXN,
    );
  });

  it('rechaza con moneda_no_mxn si el encabezado no trae moneda', () => {
    const t = texto().replace('Moneda MXN\n', '');
    let error: unknown;
    try {
      leerEstadoCuentaBbva(t);
    } catch (e) {
      error = e;
    }
    expect((error as EstadoDeCuentaRechazado).codigo).toBe(
      CODIGO_MONEDA_NO_MXN,
    );
  });

  it('rechaza si faltan el periodo o los saldos', () => {
    expect(() =>
      leerEstadoCuentaBbva(texto().replace('Saldo Final 11,250.50', '')),
    ).toThrow(EstadoDeCuentaRechazado);
    expect(() =>
      leerEstadoCuentaBbva(
        texto().replace('Periodo DEL 01/10/2026 AL 31/10/2026\n', ''),
      ),
    ).toThrow(EstadoDeCuentaRechazado);
  });

  it('toma el año del periodo y entiende los doce meses', () => {
    const meses = [
      'ENE',
      'FEB',
      'MAR',
      'ABR',
      'MAY',
      'JUN',
      'JUL',
      'AGO',
      'SEP',
      'OCT',
      'NOV',
      'DIC',
    ];
    meses.forEach((mes, i) => {
      const t = [
        'Periodo DEL 01/01/2025 AL 31/12/2025',
        'Moneda MXN',
        'Saldo Anterior 100.00',
        'Saldo Final 101.00',
        `05/${mes} 05/${mes} ABONO 1.00 101.00`,
      ].join('\n');
      const r = leerEstadoCuentaBbva(t);
      expect(r.movimientos[0].fecha).toBe(
        `2025-${String(i + 1).padStart(2, '0')}-05`,
      );
    });
  });

  it('un periodo a caballo entre años asigna el año de cada mes', () => {
    const r = leerEstadoCuentaBbva(
      [
        'Periodo DEL 15/12/2025 AL 14/01/2026',
        'Moneda MXN',
        'Saldo Anterior 100.00',
        'Saldo Final 102.00',
        '20/DIC 20/DIC ABONO 1.00 101.00',
        '05/ENE 05/ENE ABONO 1.00 102.00',
      ].join('\n'),
    );
    expect(r.movimientos.map((m) => m.fecha)).toEqual([
      '2025-12-20',
      '2026-01-05',
    ]);
  });

  it('separa la referencia opcional de la descripción', () => {
    const r = leerEstadoCuentaBbva(
      texto('02/OCT 02/OCT SPEI ENVIADO ACME Ref. 0012345 250.00 9,750.00'),
    );
    expect(r.movimientos[0]).toMatchObject({
      descripcion: 'SPEI ENVIADO ACME',
      referencia: '0012345',
    });
  });

  it('suma exacta, sin flotantes: 0.10 + 0.20 y montos grandes con miles', () => {
    const r = leerEstadoCuentaBbva(
      [
        'Periodo DEL 01/10/2026 AL 31/10/2026',
        'Moneda MXN',
        'Saldo Anterior 0.10',
        'Saldo Final 1,234,567,890.30',
        '02/OCT 02/OCT ABONO UNO 0.20 0.30',
        '03/OCT 03/OCT ABONO GRANDE 1,234,567,890.00 1,234,567,890.30',
      ].join('\n'),
    );
    expect(r.saldoInicial).toBe('0.10');
    expect(r.movimientos.map((m) => m.monto)).toEqual([
      '0.20',
      '1234567890.00',
    ]);
    expect(r.lineasNoLeidas).toEqual([]);
  });

  it('ignora líneas vacías pero cuenta bien los números de línea', () => {
    const r = leerEstadoCuentaBbva(`${texto()}\n\nbasura\r\n`);
    expect(r.lineasNoLeidas).toEqual([{ linea: 6, texto: 'basura' }]);
  });
});
