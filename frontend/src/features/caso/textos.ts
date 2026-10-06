/**
 * Todo el texto del detalle del caso vive aquí, en un solo lugar. El copy
 * está aprobado con las maquetas (Detalle.dc.html): cambiarlo es editar solo
 * este archivo. Los componentes importan estas constantes en vez de escribir
 * texto propio, y las pruebas afirman los textos normativos como literales.
 */

export const TITULO_DOCUMENTO = 'Detalle del caso · Cuadra';
export const VOLVER_A_BANDEJA = '← Volver a la bandeja';
export const CARGANDO_CASO = 'Cargando caso';

/** Movimiento bancario. */
export const MOVIMIENTO = {
  titulo: 'Movimiento bancario',
  fecha: 'Fecha',
  referencia: 'Referencia',
  descripcion: 'Descripción',
  sinReferencia: 'sin referencia',
  /** Solo para lectores de pantalla: la ✓ visible es decorativa. */
  coincideConCfdi: 'coincide con el CFDI',
} as const;

/** Tarjeta del CFDI candidato. */
export const CFDI = {
  titulo: 'CFDI candidato',
  emision: 'Emisión',
  serieFolio: 'Serie-folio',
  uuid: 'UUID',
  /** Solo para lectores de pantalla: la ✓ visible es decorativa. */
  coincideConMovimiento: 'coincide con el movimiento',
} as const;

/** Tarjeta de la diferencia con la tolerancia de la empresa. */
export const DIFERENCIA = {
  titulo: 'Diferencia',
  dentroDeTolerancia: 'Dentro de la tolerancia de la empresa',
  tolerancia: 'tolerancia',
  menorAUnCentavo: 'menor a un centavo',
} as const;

/** Tarjeta de por qué el motor propone el CFDI. */
export const MOTOR = {
  titulo: 'Por qué el motor lo propone',
  soloProponen:
    'El motor y la IA solo proponen. Solo una persona cierra un caso.',
} as const;

/** Lista de propuestas. */
export const PROPUESTAS = {
  titulo: 'Propuestas',
  verPropuesta: 'Ver propuesta',
  /** Aviso con la cantidad real: solo con dos o más propuestas. */
  aviso: (cantidad: number) =>
    `Este movimiento tiene ${cantidad} propuestas. Al confirmar una, las demás se rechazan.`,
} as const;

/** Glifo del chip de estado: decorativo, el texto lleva el significado. */
export const GLIFOS_ESTADO = {
  sugerencia: '●',
  sin_match: '○',
  conciliado: '✓',
} as const;
