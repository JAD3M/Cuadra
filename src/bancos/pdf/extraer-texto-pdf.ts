import {
  CODIGO_PDF_ILEGIBLE,
  CODIGO_PDF_SIN_TEXTO,
  EstadoDeCuentaRechazado,
  MENSAJE_PDF_ILEGIBLE,
} from '../lector-estado-cuenta';

/**
 * Adaptador delgado de extracción de texto de PDF (AD-8). Es el único lugar
 * que conoce la librería; los lectores por banco reciben solo texto.
 */
export async function extraerTextoPdf(buffer: Buffer): Promise<string> {
  let texto: string;
  try {
    // Import dinámico: unpdf es ESM y el build del backend es CommonJS.
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    ({ text: texto } = await extractText(pdf, { mergePages: true }));
  } catch {
    throw new EstadoDeCuentaRechazado(
      MENSAJE_PDF_ILEGIBLE,
      CODIGO_PDF_ILEGIBLE,
    );
  }
  if (texto.trim() === '') {
    throw new EstadoDeCuentaRechazado(
      'El PDF no tiene texto (parece escaneado). Descarga el estado de cuenta en PDF desde el portal del banco y vuelve a subirlo.',
      CODIGO_PDF_SIN_TEXTO,
    );
  }
  return texto;
}
