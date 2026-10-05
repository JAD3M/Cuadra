/**
 * Textos de las pantallas de acceso. Los avisos se indexan por el motivo
 * por el que se llegó a `/login`; los motivos se repiten aquí (en vez de
 * importar el tipo de la sesión) porque los componentes de presentación no
 * dependen de ella. `textos.test.ts` comprueba que coinciden.
 */
export type MotivoAviso =
  | 'sesion_expirada'
  | 'sin_acceso'
  | 'cierre_voluntario'
  | 'reingreso'
  | 'seleccion_vencida'
  | 'sin_empresas';

export const AVISOS: Record<MotivoAviso, string> = {
  sesion_expirada: 'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
  sin_acceso: 'Ya no tienes acceso a esta empresa.',
  cierre_voluntario: 'Cerraste sesión.',
  reingreso:
    'Por seguridad, vuelve a ingresar tu contraseña para cambiar de empresa.',
  seleccion_vencida:
    'Tu tiempo para elegir empresa terminó. Vuelve a iniciar sesión.',
  sin_empresas:
    'Tu usuario no tiene empresas asignadas. Contacta a un administrador.',
};

/** Texto del aviso de `/login` para un motivo de salida. */
export function textoAviso(motivo: MotivoAviso): string {
  return AVISOS[motivo];
}

const NUMEROS = [
  'una',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
] as const;

/** "una empresa", "dos empresas" ... "diez empresas", luego "11 empresas". */
export function textoEmpresas(cantidad: number): string {
  if (cantidad === 1) return 'una empresa';
  const palabra = NUMEROS[cantidad - 1];
  return `${palabra ?? cantidad} empresas`;
}

/** Primera palabra del nombre completo; vacío si no hay nombre. */
export function primeraPalabra(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? '';
}

/** Saludo del paso de elección de empresa al entrar. */
export function saludoEmpresas(nombre: string, cantidad: number): string {
  const primero = primeraPalabra(nombre);
  const conteo = `Tienes acceso a ${textoEmpresas(cantidad)}.`;
  return primero ? `Hola, ${primero}. ${conteo}` : `Hola. ${conteo}`;
}

/** Saludo del paso de elección de empresa cuando se cambia de empresa. */
export function saludoCambio(empresa?: string): string {
  return empresa
    ? `Estás en ${empresa}. Elige la empresa a la que quieres cambiar.`
    : 'Elige la empresa a la que quieres cambiar.';
}
