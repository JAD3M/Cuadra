import {
  CODIGO_PDF_ILEGIBLE,
  CODIGO_PDF_SIN_TEXTO,
  EstadoDeCuentaRechazado,
} from '../lector-estado-cuenta';
import { extraerTextoPdf } from './extraer-texto-pdf';
import { construirPdfSintetico } from './pdf-sintetico';

describe('extraerTextoPdf', () => {
  it('devuelve el texto de un PDF con capa de texto', async () => {
    const pdf = construirPdfSintetico(['SALDO INICIAL 1000.00', 'DEPOSITO 50']);
    const texto = await extraerTextoPdf(pdf);
    expect(texto).toContain('SALDO INICIAL 1000.00');
    expect(texto).toContain('DEPOSITO 50');
  });

  it('rechaza con pdf_sin_texto un PDF sin capa de texto (escaneado)', async () => {
    const error = await extraerTextoPdf(construirPdfSintetico([])).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(EstadoDeCuentaRechazado);
    expect((error as EstadoDeCuentaRechazado).codigo).toBe(
      CODIGO_PDF_SIN_TEXTO,
    );
    expect((error as Error).message).toMatch(/portal/i);
  });

  it('rechaza con pdf_ilegible bytes que no son un PDF', async () => {
    const error = await extraerTextoPdf(
      Buffer.from('esto no es un pdf, solo basura'),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EstadoDeCuentaRechazado);
    expect((error as EstadoDeCuentaRechazado).codigo).toBe(CODIGO_PDF_ILEGIBLE);
  });
});
