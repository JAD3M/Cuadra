import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extraerTextoPdf } from './extraer-texto-pdf';
import { leerEstadoCuentaBbva } from './lector-bbva';

// SINTÉTICO: el fixture no es un estado de cuenta real de BBVA.
describe('PDF sintético de BBVA: extracción y lectura', () => {
  it('extrae el texto del PDF y lo lee de punta a punta', async () => {
    const pdf = readFileSync(
      join(__dirname, '..', 'fixtures', 'bbva-sintetico.pdf'),
    );
    const resultado = leerEstadoCuentaBbva(await extraerTextoPdf(pdf));
    expect(resultado.saldoInicial).toBe('10000.00');
    expect(resultado.saldoFinal).toBe('11250.50');
    expect(resultado.movimientos.map((m) => m.monto)).toEqual([
      '-250.00',
      '1500.50',
    ]);
    expect(resultado.lineasNoLeidas).toEqual([]);
  });
});
