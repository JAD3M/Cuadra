import {
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  REINTENTAR,
} from '@/features/bandeja/textos';
import type { ErrorMarca } from './errores';

// Textos de la pantalla de Muestra de verificación (mockups «22 · Muestra de
// verificación» y «23 · Muestra de verificación (tema claro)»). Todo el texto
// vive aquí.

export { ERROR_CONEXION, ERROR_SIN_PERMISO, REINTENTAR };

export const TITULO_PAGINA = 'Muestra de verificación';
export const TITULO_DOCUMENTO = 'Muestra de verificación · Cuadra';
export const subtituloPagina = (empresa: string): string =>
  `${empresa} · propuestas de la regla 1 confirmadas en lote`;

export const MES = 'Mes';
export const CARGANDO = 'Cargando la muestra';

export const AVISO_SIN_REVISOR = {
  titulo: 'Tu empresa no tiene a nadie con el rol Revisor',
  detalle:
    'Por eso esta muestra la verifica la administración. Cuando alguien reciba el rol Revisor, la verificación pasa a esa persona.',
} as const;

export const AVISO_SOLO_CONSULTA = {
  titulo: 'Solo consulta',
  detalle:
    'Con el rol Auditor puedes ver la muestra y las marcas de cada caso, pero no marcarlos.',
} as const;

export const sinMuestra = (mes: string) => ({
  titulo: 'No hay muestra de este mes',
  detalle: `En ${mes} no hubo confirmaciones en lote de la regla 1, así que Cuadra no creó muestra. No falta nada por verificar.`,
});

export const AVANCE = {
  titulo: 'Avance',
  barra: 'Casos verificados',
  conformes: 'Conformes',
  desacuerdos: 'En desacuerdo',
  pendientes: 'Pendientes',
  verificados: (verificados: number, total: number) => ({
    cifras: `${verificados} de ${total}`,
    resto: ' casos verificados',
  }),
  completa: (mes: string) =>
    `Verificaste todos los casos de ${mes}. Los que quedaron en desacuerdo siguen confirmados hasta que alguien los reabra desde su detalle.`,
} as const;

export const LISTA = {
  titulo: 'Casos de la muestra',
  grupoFiltros: 'Filtrar casos',
  todos: 'Todos',
  pendientes: 'Pendientes',
  desacuerdo: 'En desacuerdo',
  vacia: 'Ningún caso coincide con este filtro.',
  chips: {
    pendiente: 'Pendiente',
    conforme: 'Conforme',
    desacuerdo: 'En desacuerdo',
  },
} as const;

export const DETALLE = {
  titulo: (n: number, total: number) => ({
    n: String(n),
    total: String(total),
  }),
  anterior: 'Caso anterior',
  siguiente: 'Caso siguiente',
  anteriorTexto: '← Anterior',
  siguienteTexto: 'Siguiente →',
  movimiento: 'Movimiento bancario',
  cfdi: 'CFDI candidato',
  cfdis: 'CFDI candidatos',
  sinCfdi: 'Sin CFDI candidato',
  referencia: 'Referencia',
  folio: 'Folio',
  regla: 'Regla y confirmación',
  confirmadaEnLote: 'Confirmada en lote por',
  el: 'el',
} as const;

export const VERIFICACION = {
  titulo: 'Tu verificación',
  conforme: 'Conforme',
  desacuerdo: 'En desacuerdo',
  nota: 'Marcar «En desacuerdo» no reabre nada por sí solo. Si hace falta corregir la confirmación, se reabre desde el detalle del caso.',
  propia: {
    titulo: 'Tú confirmaste este lote',
    detalle:
      'Quien confirma un lote no verifica sus casos mientras haya otra persona que pueda hacerlo. Este caso lo marca alguien más.',
  },
  soloVer:
    'Sin marcar todavía. Con el rol Auditor puedes ver este caso, pero no marcarlo.',
  reabierta: 'Este caso ya fue reabierto; ya no se marca.',
  marcadoConforme: 'Marcado conforme',
  marcadoDesacuerdo: 'Marcado en desacuerdo',
  desacuerdoNoReabre:
    'Esto no reabre nada por sí solo: la confirmación sigue vigente.',
  enlaceDetalle: 'Abrir el detalle del caso para reabrir la confirmación →',
  cambiar: 'Cambiar marca',
} as const;

export const MARCAS = {
  titulo: 'Marcas de este caso',
  conforme: 'conforme',
  desacuerdo: 'en desacuerdo',
} as const;

/** Aviso de un fallo al marcar; el texto nunca sale del servidor. */
export const ERRORES_MARCA: Record<
  ErrorMarca,
  { titulo: string; detalle?: string }
> = {
  sin_permiso: {
    titulo: 'No puedes marcar este caso.',
    detalle: 'El servidor no lo permite a tu usuario.',
  },
  no_encontrado: {
    titulo: 'Este caso ya no está en la muestra.',
    detalle: 'Se volvió a leer la muestra.',
  },
  reabierta: {
    titulo: 'Este caso ya fue reabierto; ya no se marca.',
    detalle: 'Se volvió a leer la muestra.',
  },
  conexion: ERROR_CONEXION,
  generico: {
    titulo: 'No se pudo registrar la marca.',
    detalle: 'Inténtalo de nuevo.',
  },
};
