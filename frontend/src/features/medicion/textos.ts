import { ERROR_CONEXION, ERROR_SIN_PERMISO } from '@/features/bandeja/textos';

// Textos de la pantalla de Medición (mockup `Medicion.dc.html`, tablero
// «19 · Medición (admin)»). Todo el texto vive aquí.

export { ERROR_CONEXION, ERROR_SIN_PERMISO };
export { REINTENTAR } from '@/features/bandeja/textos';

export const TITULO_PAGINA = 'Medición';
export const TITULO_DOCUMENTO = 'Medición · Cuadra';
export const subtituloPagina = (empresa: string): string =>
  `${empresa} · propuestas de la regla 1`;

export const TARJETA_TASA = {
  titulo: 'Tasa de desacuerdo',
  cargando: 'Cargando la medición',
  explicacion:
    'de las propuestas de la regla 1 ya tratadas tuvieron desacuerdo.',
  propuestas: 'Propuestas hechas',
  tratadas: 'Tratadas por el equipo',
  desacuerdos: 'Con desacuerdo',
} as const;

export const SIN_DATOS = {
  titulo: 'Todavía no hay datos',
  detalle:
    'Cuando Cuadra proponga la regla 1 y tu equipo las trate, aquí verás con qué frecuencia no está de acuerdo.',
} as const;

export const SIN_TRATADAS = {
  titulo: 'Todavía no hay propuestas tratadas',
  detalle: (propuestas: number): string =>
    `Cuadra ya hizo ${propuestas} propuestas de la regla 1, pero tu equipo aún no confirma, rechaza ni desmarca ninguna. La tasa aparece cuando haya alguna tratada.`,
} as const;

export const COMO_SE_CUENTA = {
  titulo: 'Cómo se cuenta',
  puntos: [
    {
      marca: '✕',
      tono: 'desacuerdo',
      texto:
        'Hay desacuerdo cuando se rechaza una propuesta, se reabre una confirmación o se desmarca y luego se resuelve de otra forma.',
    },
    {
      marca: '✓',
      tono: 'acuerdo',
      texto:
        'No cuenta si se desmarca y luego se confirma igual, ni una desmarcada que sigue pendiente.',
    },
    {
      marca: 'i',
      tono: 'info',
      texto:
        'La tasa se calcula con los eventos de tu empresa cada vez que abres esta pantalla; no es un número guardado.',
    },
  ],
} as const;
