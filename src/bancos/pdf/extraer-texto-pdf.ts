import {
  CODIGO_PDF_CONTRASENA_INCORRECTA,
  CODIGO_PDF_ILEGIBLE,
  CODIGO_PDF_REQUIERE_CONTRASENA,
  CODIGO_PDF_SIN_TEXTO,
  EstadoDeCuentaRechazado,
  MENSAJE_PDF_CONTRASENA_INCORRECTA,
  MENSAJE_PDF_ILEGIBLE,
  MENSAJE_PDF_REQUIERE_CONTRASENA,
} from '../lector-estado-cuenta';

/**
 * Adaptador delgado de extracción de texto de PDF (AD-8). Es el único lugar
 * que conoce la librería; los lectores por banco reciben solo texto.
 *
 * `contrasena` (historia 8.2) solo abre un PDF protegido: vive en memoria
 * durante esta llamada y no se guarda, no se registra y no entra a ningún
 * mensaje de error. Un PDF sin protección la ignora.
 */
export async function extraerTextoPdf(
  buffer: Buffer,
  contrasena?: string,
): Promise<string> {
  let texto: string;
  try {
    // Import dinámico: unpdf es ESM y el build del backend es CommonJS.
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer), {
      password: contrasena,
    });
    ({ text: texto } = await extractText(pdf, { mergePages: true }));
  } catch (error) {
    const rechazo = rechazoDeContrasena(error);
    if (rechazo) throw rechazo;
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

/** Códigos de `PasswordException` de pdf.js: 1 falta la contraseña, 2 no abre. */
const PDFJS_NECESITA_CONTRASENA = 1;
const PDFJS_CONTRASENA_INCORRECTA = 2;

/**
 * El rechazo que corresponde a una excepción de contraseña de pdf.js, o null
 * si el error es otro. Los mensajes son fijos: nunca incluyen la contraseña.
 */
function rechazoDeContrasena(error: unknown): EstadoDeCuentaRechazado | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    (error as { name?: unknown }).name !== 'PasswordException'
  ) {
    return null;
  }
  const codigo = (error as { code?: unknown }).code;
  if (codigo === PDFJS_NECESITA_CONTRASENA) {
    return new EstadoDeCuentaRechazado(
      MENSAJE_PDF_REQUIERE_CONTRASENA,
      CODIGO_PDF_REQUIERE_CONTRASENA,
    );
  }
  if (codigo === PDFJS_CONTRASENA_INCORRECTA) {
    return new EstadoDeCuentaRechazado(
      MENSAJE_PDF_CONTRASENA_INCORRECTA,
      CODIGO_PDF_CONTRASENA_INCORRECTA,
    );
  }
  return null;
}
