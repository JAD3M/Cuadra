import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CODIGO_PDF_CONTRASENA_INCORRECTA,
  CODIGO_PDF_ILEGIBLE,
  CODIGO_PDF_REQUIERE_CONTRASENA,
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

  // SINTÉTICO: el PDF protegido es de pruebas; su contraseña no protege nada.
  describe('PDF protegido con contraseña', () => {
    const protegido = readFileSync(
      join(__dirname, '..', 'fixtures', 'santander-protegido-sintetico.pdf'),
    );

    const rechazo = (promesa: Promise<string>) =>
      promesa.catch((e: unknown) => e as EstadoDeCuentaRechazado);

    it('sin contraseña: pdf_requiere_contrasena, no pdf_ilegible', async () => {
      const error = await rechazo(extraerTextoPdf(protegido));
      expect(error).toBeInstanceOf(EstadoDeCuentaRechazado);
      expect((error as EstadoDeCuentaRechazado).codigo).toBe(
        CODIGO_PDF_REQUIERE_CONTRASENA,
      );
      expect((error as Error).message).toMatch(/contraseña/i);
    });

    it('con una contraseña incorrecta: pdf_contrasena_incorrecta', async () => {
      const error = await rechazo(extraerTextoPdf(protegido, 'mala'));
      expect((error as EstadoDeCuentaRechazado).codigo).toBe(
        CODIGO_PDF_CONTRASENA_INCORRECTA,
      );
      expect((error as Error).message).toMatch(/no es correcta/i);
    });

    it('con la contraseña correcta devuelve el texto', async () => {
      const texto = await extraerTextoPdf(protegido, 'clave-prueba');
      expect(texto).toContain('BANCO SANTANDER');
    });

    it('el mensaje de rechazo nunca trae la contraseña escrita', async () => {
      const error = await rechazo(extraerTextoPdf(protegido, 'mala-secreta'));
      expect((error as Error).message).not.toContain('mala-secreta');
    });

    it('un PDF sin protección ignora la contraseña que sobre', async () => {
      const texto = await extraerTextoPdf(
        construirPdfSintetico(['SALDO INICIAL 1000.00']),
        'sobra',
      );
      expect(texto).toContain('SALDO INICIAL 1000.00');
    });
  });
});
