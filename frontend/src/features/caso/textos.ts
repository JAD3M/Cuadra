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
  /** Nota del detalle para quien no tiene `conciliaciones.resolver`. */
  soloLectura: 'Solo lectura: tu rol no puede confirmar ni rechazar.',
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

/** Conciliado cuya factura se canceló: Cuadra no lo reabre, pide revisión. */
export const REQUIERE_REVISION = {
  titulo: 'Requiere revisión',
  /** Solo nombra las facturas que el servidor marca canceladas; sin ninguna, no inventa. */
  cancelada: (etiquetas: readonly string[]) => {
    const ultima = etiquetas.at(-1);
    if (ultima === undefined) {
      return 'Una de las facturas de esta conciliación fue cancelada. Revisa esta conciliación.';
    }
    if (etiquetas.length === 1) {
      return `La factura ${ultima} fue cancelada. Revisa esta conciliación.`;
    }
    const lista = `${etiquetas.slice(0, -1).join(', ')} y ${ultima}`;
    return `Las facturas ${lista} fueron canceladas. Revisa esta conciliación.`;
  },
  /** Pieza a pieza: el servidor puede no traer el usuario o la fecha. */
  nota: (usuario: string | null, fecha: string | null) =>
    [
      'Cuadra no la reabre sola.',
      usuario === null && fecha === null
        ? null
        : CONCILIADO.confirmado(usuario, fecha),
    ]
      .filter((p): p is string => p !== null)
      .join(' '),
} as const;

/** Historial de la propuesta, a la derecha en la maqueta. */
export const HISTORIAL = {
  titulo: 'Historial',
  vacio: 'Aún no hay eventos en el historial.',
  /** Actor de un evento sin usuario. */
  sistema: 'Sistema',
  /** Separador de «{usuario} · {detalle}». */
  separador: ' · ',
  /** La propuesta cuando el CFDI ya no está a la vista (p. ej. rechazada). */
  propuestaSinCfdi: 'El motor propuso un CFDI',
  /** Evento 4.6: una factura de la decisión se marcó cancelada. */
  facturaCancelada: (etiqueta: string | null) =>
    etiqueta === null
      ? 'Una factura de esta conciliación se marcó cancelada'
      : `La factura ${etiqueta} se marcó cancelada`,
  facturaCanceladaDetalle:
    'Cuadra no reabre la conciliación: hace falta revisarla',
  /** Fila derivada del estado del servidor: no es un evento real. */
  pendiente: {
    titulo: 'Esperando decisión',
    detalle: 'Nadie ha confirmado ni rechazado',
    cuando: '—',
  },
} as const;

/** Banner tras confirmar o rechazar, armado con la respuesta del servidor. */
export const BANNER = {
  confirmado:
    'Conciliación confirmada. El movimiento y el CFDI quedan cerrados.',
  rechazado: 'Propuesta rechazada.',
  /** Separador de «{usuario} · {fecha}». */
  separadorDetalle: ' · ',
  unaHermana: 'La otra propuesta de este movimiento se rechazó.',
  variasHermanas: 'Las demás propuestas de este movimiento se rechazaron.',
  queda: 'Queda 1 propuesta vigente para este movimiento.',
  quedan: (cantidad: number) =>
    `Quedan ${cantidad} propuestas vigentes para este movimiento.`,
  vuelveASinMatch: 'El movimiento vuelve a sin match.',
} as const;

/** Descartar un movimiento que no es de ningún cliente (5.6, maquetas 3 y 8). */
export const DESCARTE = {
  accion: 'Descartar movimiento',
  ayuda:
    'Para comisiones, intereses y otros movimientos que no son de ningún cliente.',
  titulo: 'Descartar movimiento',
  motivoEtiqueta: 'Motivo del descarte (obligatorio)',
  motivoEjemplo: 'Ej. comisión bancaria',
  motivoObligatorio: 'El motivo es obligatorio para descartar.',
  motivoLargo: 'El motivo no puede pasar de 500 caracteres.',
  confirmar: 'Descartar movimiento',
  descartando: 'Descartando…',
  cancelar: 'Cancelar',
  nota: 'Queda en la bitácora con tu nombre y el motivo. Puedes deshacerlo después.',
  /** Región en vivo (solo lectores) mientras el descarte viaja al servidor. */
  enviando: 'Descartando el movimiento',
} as const;

/** Variante de solo lectura de un movimiento descartado. */
export const DESCARTADO = {
  /** Glifo decorativo del chip: el texto lleva el significado. */
  glifo: '⊘',
  titulo: 'Descartado',
  principal: 'Este movimiento se descartó: no es de ningún cliente.',
  motivo: 'Motivo',
  por: 'Descartado por',
  fecha: 'Fecha',
  nota: 'Mientras siga descartado no se muestran sus propuestas y no aparece en la bandeja.',
  deshacer: 'Deshacer descarte',
  deshaciendo: 'Deshaciendo…',
  deshacerAyuda: 'El movimiento vuelve a la bandeja como pendiente.',
  /** Su rol no tiene el permiso (por ejemplo, el auditor). */
  soloLecturaRol: 'Solo lectura: tu rol no puede deshacer descartes.',
  /** Su rol lo tiene, pero el servidor dice que este descarte no es suyo. */
  soloAutorOAdmin:
    'Solo quien descartó el movimiento o un administrador puede deshacer el descarte.',
  /** Evento del historial derivado del descarte vigente. */
  evento: 'Descartado',
  /** Sin dato del servidor no se inventa nada. */
  sinDato: '—',
} as const;
