import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extraerTextoPdf } from './extraer-texto-pdf';
import { leerEstadoCuentaBanorte } from './lector-banorte';

// SINTÉTICO: el fixture no es un estado de cuenta real de Banorte.
describe('PDF sintético de Banorte: extracción y lectura', () => {
  it('extrae el texto del PDF y lo lee de punta a punta', async () => {
    const pdf = readFileSync(
      join(__dirname, '..', 'fixtures', 'banorte-sintetico.pdf'),
    );
    const resultado = leerEstadoCuentaBanorte(await extraerTextoPdf(pdf));
    expect(resultado.saldoInicial).toBe('10000.00');
    expect(resultado.saldoFinal).toBe('11250.50');
    expect(resultado.movimientos.map((m) => m.monto)).toEqual([
      '-250.00',
      '1500.50',
    ]);
    expect(resultado.lineasNoLeidas).toEqual([]);
  });
});
