/**
 * Todo el texto del detalle del caso vive aquí, en un solo lugar. El copy
 * está aprobado con las maquetas (Detalle.dc.html): cambiarlo es editar solo
 * este archivo. Los componentes importan estas constantes en vez de escribir
 * texto propio, y las pruebas afirman los textos normativos como literales.
 */

export const TITULO_DOCUMENTO = 'Detalle del caso · Cuadra';
export const VOLVER_A_BANDEJA = '← Volver a la bandeja';
export const CARGANDO_CASO = 'Cargando caso';
export const VOLVER_A_BANDEJA_ACCION = 'Volver a la bandeja';
export const RECARGAR_CASO = 'Recargar caso';

/**
 * Fallos propios del caso. El de conectividad y el de permiso genérico son
 * los de la bandeja (`@/features/bandeja/textos`) y no se repiten aquí.
 */
export const ERRORES = {
  contrato: {
    titulo: 'No pudimos mostrar este caso.',
    detalle:
      'El servidor respondió con datos inesperados. Inténtalo de nuevo más tarde.',
  },
  noEncontrado: {
    titulo: 'No encontramos este caso.',
    detalle: 'Puede que no exista o que pertenezca a otra empresa.',
  },
  segregacion: {
    titulo: 'No puedes confirmar este caso.',
    detalle:
      'Quien subió el CFDI o el estado de cuenta no puede confirmarlo. Pide a otra persona de la empresa que lo revise.',
  },
  conflicto: {
    titulo: 'Este caso ya cambió.',
    detalle:
      'Otra persona lo resolvió o la propuesta ya no está vigente. Recarga para ver su estado actual.',
  },
} as const;

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
} as const;

/** Tarjeta «Tu decisión»: confirmar con un clic y rechazar con motivo opcional. */
export const DECISION = {
  titulo: 'Tu decisión',
  /** Glifos decorativos: el texto lleva el significado. */
  glifoConfirmar: '✓',
  glifoRechazar: '✕',
  confirmar: 'Confirmar conciliación',
  confirmando: 'Confirmando…',
  rechazar: 'Rechazar',
  rechazando: 'Rechazando…',
  /** Región en vivo (solo lectores) mientras la decisión viaja al servidor. */
  enviando: 'Enviando tu decisión',
  motivoEtiqueta: 'Motivo del rechazo (opcional)',
  motivoEjemplo: 'Ej. el CFDI corresponde a otra obra',
  motivoLargo: 'El motivo no puede pasar de 500 caracteres.',
  /** Contador en enteros: largo bruto sobre el máximo. */
  contador: (largo: number, maximo: number) => `${largo} / ${maximo}`,
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

/** Variante de solo lectura: el motor no propuso nada. */
export const SIN_MATCH = {
  titulo: 'Sin match',
  principal: 'El motor no encontró un CFDI seguro para este movimiento.',
  secundaria: 'Este caso no tiene propuestas que confirmar.',
} as const;

/** Variante de solo lectura: un humano ya confirmó. */
export const CONCILIADO = {
  titulo: 'Conciliado',
  cerrado: 'Este caso ya está cerrado y no admite cambios.',
  /** Pieza a pieza: el servidor puede no traer el usuario o la fecha. */
  confirmado: (usuario: string | null, fecha: string | null) =>
    [
      'Confirmado',
      usuario === null ? null : `por ${usuario}`,
      fecha === null ? null : `el ${fecha}`,
    ]
      .filter((p): p is string => p !== null)
      .join(' ') + '.',
} as const;

/** Historial de la propuesta, a la derecha en la maqueta. */
export const HISTORIAL = {
  titulo: 'Historial',
  vacio: 'Aún no hay eventos en el historial.',
  /** Actor de un evento sin usuario. */
  sistema: 'Sistema',
  /** La propuesta cuando el CFDI ya no está a la vista (p. ej. rechazada). */
  propuestaSinCfdi: 'El motor propuso un CFDI',
  /** Fila derivada del estado del servidor: no es un evento real. */
  pendiente: {
    titulo: 'Esperando decisión',
    detalle: 'Nadie ha confirmado ni rechazado',
    cuando: '—',
  },
} as const;
