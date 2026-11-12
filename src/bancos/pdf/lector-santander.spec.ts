import { EstadoDeCuentaRechazado } from '../lector-estado-cuenta';
import { leerEstadoCuentaSantander } from './lector-santander';

// SINTÉTICO [SUPUESTO]: layout de Santander cuenta empresarial, no un PDF real.
const ENCABEZADO = [
  'DOCUMENTO SINTETICO - SIN DATOS REALES',
  'BANCO SANTANDER',
  'CUENTA EMPRESARIAL',
  'Periodo: 01/09/2026 - 30/09/2026',
  'Divisa: MXN',
  'Saldo inicial del periodo: 10,000.00',
  'Saldo final del periodo: 11,250.50',
  'FECHA CONCEPTO IMPORTE SALDO',
];
const texto = (...lineas: string[]) => [...ENCABEZADO, ...lineas].join('\n');

function rechazo(t: string): EstadoDeCuentaRechazado {
  try {
    leerEstadoCuentaSantander(t);
  } catch (e) {
    return e as EstadoDeCuentaRechazado;
  }
  throw new Error('no rechazó');
}

describe('leerEstadoCuentaSantander', () => {
  it('lee saldos, movimientos con signo por saldo corrido y referencia', () => {
    const r = leerEstadoCuentaSantander(
      texto(
        '05/09/2026 COMISION MANEJO DE CUENTA Ref: 8841 -250.00 9,750.00',
        '12/09/2026 DEPOSITO CLIENTE 1,500.50 11,250.50',
      ),
    );
    expect(r.saldoInicial).toBe('10000.00');
    expect(r.saldoFinal).toBe('11250.50');
    expect(r.lineasNoLeidas).toEqual([]);
    expect(r.movimientos).toEqual([
      {
        fecha: '2026-09-05',
        descripcion: 'COMISION MANEJO DE CUENTA',
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
    const linea = '05/09/2026 PAGO 100.00 9,000.00';
    const r = leerEstadoCuentaSantander(texto(linea));
    expect(r.movimientos).toEqual([]);
    expect(r.lineasNoLeidas).toEqual([
      { linea: ENCABEZADO.length + 1, texto: linea },
    ]);
  });

  it('reporta una fecha inexistente en vez de adivinar', () => {
    const r = leerEstadoCuentaSantander(
      texto('31/09/2026 PAGO -250.00 9,750.00'),
    );
    expect(r.movimientos).toEqual([]);
    expect(r.lineasNoLeidas).toHaveLength(1);
  });

  it('rechaza una moneda distinta de MXN con el mismo código que los demás', () => {
    const e = rechazo(texto().replace('Divisa: MXN', 'Divisa: USD'));
    expect(e.codigo).toBe('moneda_no_mxn');
  });

  it('rechaza con mensaje claro un diseño que no es el empresarial', () => {
    const e = rechazo(texto().replace('CUENTA EMPRESARIAL', 'CUENTA'));
    expect(e.message).toMatch(/empresarial de Santander/);
  });

  it('rechaza un PDF de otro banco', () => {
    const e = rechazo(texto().replace('BANCO SANTANDER', 'OTRO BANCO'));
    expect(e.message).toMatch(/empresarial de Santander/);
  });

  it('rechaza si falta el periodo o un saldo', () => {
    const e = rechazo(
      texto().replace('Saldo final del periodo: 11,250.50', ''),
    );
    expect(e.message).toMatch(/periodo o los saldos/);
  });
});
