import { EstadoDeCuentaRechazado } from '../lector-estado-cuenta';
import { leerEstadoCuentaBanorte } from './lector-banorte';

// SINTÉTICO: layout supuesto de Banorte Empresas, no un PDF real.
const ENCABEZADO = [
  'DOCUMENTO SINTETICO - SIN DATOS REALES',
  'BANORTE',
  'ESTADO DE CUENTA EMPRESARIAL',
  'Periodo: 01/09/2026 al 30/09/2026',
  'Moneda: MXN',
  'Saldo inicial: 10,000.00',
  'Saldo final: 11,250.50',
  'FECHA DESCRIPCION IMPORTE SALDO',
];
const texto = (...lineas: string[]) => [...ENCABEZADO, ...lineas].join('\n');

function rechazo(t: string): EstadoDeCuentaRechazado {
  try {
    leerEstadoCuentaBanorte(t);
  } catch (e) {
    return e as EstadoDeCuentaRechazado;
  }
  throw new Error('no rechazó');
}

describe('leerEstadoCuentaBanorte', () => {
  it('lee saldos, movimientos con signo por saldo corrido y referencia', () => {
    const r = leerEstadoCuentaBanorte(
      texto(
        '05-SEP-2026 PAGO DE NOMINA REF 8841 -250.00 9,750.00',
        '12-SEP-2026 DEPOSITO CLIENTE 1,500.50 11,250.50',
      ),
    );
    expect(r.saldoInicial).toBe('10000.00');
    expect(r.saldoFinal).toBe('11250.50');
    expect(r.lineasNoLeidas).toEqual([]);
    expect(r.movimientos).toEqual([
      {
        fecha: '2026-09-05',
        descripcion: 'PAGO DE NOMINA',
        referencia: '8841',
        monto: '-250.00',
      },
      {
        fecha: '2026-09-12',
        descripcion: 'DEPOSITO CLIENTE',
        referencia: null,
        monto: '1500.50',
      },
    ]);
  });

  it('reporta como no leída la línea cuyo importe no cuadra con el saldo', () => {
    const r = leerEstadoCuentaBanorte(
      texto('05-SEP-2026 PAGO 100.00 9,000.00'),
    );
    expect(r.movimientos).toEqual([]);
    expect(r.lineasNoLeidas).toEqual([
      {
        linea: ENCABEZADO.length + 1,
        texto: '05-SEP-2026 PAGO 100.00 9,000.00',
      },
    ]);
  });

  it('reporta una fecha inexistente en vez de adivinar', () => {
    const r = leerEstadoCuentaBanorte(
      texto('31-SEP-2026 PAGO -250.00 9,750.00'),
    );
    expect(r.movimientos).toEqual([]);
    expect(r.lineasNoLeidas).toHaveLength(1);
  });

  it('rechaza una moneda distinta de MXN con el mismo código que BBVA', () => {
    const e = rechazo(texto().replace('Moneda: MXN', 'Moneda: USD'));
    expect(e.codigo).toBe('moneda_no_mxn');
  });

  it('rechaza con mensaje claro un diseño que no es el empresarial', () => {
    const e = rechazo(
      texto().replace('ESTADO DE CUENTA EMPRESARIAL', 'ESTADO DE CUENTA'),
    );
    expect(e.message).toMatch(/empresarial de Banorte/);
  });

  it('rechaza un PDF de otro banco', () => {
    const e = rechazo(texto().replace('BANORTE', 'OTRO BANCO'));
    expect(e.message).toMatch(/empresarial de Banorte/);
  });

  it('rechaza si falta el periodo o un saldo', () => {
    const e = rechazo(texto().replace('Saldo final: 11,250.50', ''));
    expect(e.message).toMatch(/periodo o los saldos/);
  });
});
