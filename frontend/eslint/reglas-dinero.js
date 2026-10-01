/**
 * Reglas para el código que toca dinero: los montos nunca pasan por flotante.
 * Aplican a `shared/dinero`, al componente Monto y a los contratos de la API.
 *
 * `no-restricted-syntax` reemplaza (no mezcla) la configuración de otros
 * bloques, así que el selector de `dangerouslySetInnerHTML` de
 * `arquitectura.js` se repite aquí para que estos archivos no lo pierdan.
 */
const GLOBALES_PROHIBIDOS = [
  'Number',
  'parseFloat',
  'parseInt',
  'Math',
  'Intl',
];

const MENSAJE =
  'Los montos son cadenas decimales: no uses Number, parseFloat, parseInt, Math, Intl ni toLocaleString (usa decimal.js).';

const SINTAXIS_DINERO = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'dangerouslySetInnerHTML está prohibido.',
  },
  {
    selector: "UnaryExpression[operator='+']",
    message: `El + unario convierte a Number. ${MENSAJE}`,
  },
  {
    selector: "MemberExpression[property.name='toLocaleString']",
    message: `toLocaleString convierte a Number. ${MENSAJE}`,
  },
  {
    selector: "CallExpression[callee.property.name='toNumber']",
    message: `Decimal#toNumber pierde precisión. ${MENSAJE}`,
  },
  {
    selector: `MemberExpression[object.name=/^(globalThis|window|self)$/][property.name=/^(${GLOBALES_PROHIBIDOS.join('|')})$/]`,
    message: `Acceder al global por globalThis/window/self no evita la regla. ${MENSAJE}`,
  },
];

const SINTAXIS_CONTRATOS = [
  ...SINTAXIS_DINERO,
  {
    selector:
      "CallExpression[callee.object.name='z'][callee.property.name='number']",
    message:
      'z.number() está prohibido en los contratos: los montos viajan como cadena (usa montoDecimal). Un número que no es dinero necesita eslint-disable con su razón.',
  },
];

const globalesProhibidos = GLOBALES_PROHIBIDOS.map((name) => ({
  name,
  message: MENSAJE,
}));

export const ARCHIVOS_DINERO = [
  'src/shared/dinero/**/*.{ts,tsx}',
  'src/shared/ui/Monto*.{ts,tsx}',
];

export const ARCHIVOS_CONTRATOS = ['src/shared/api/contratos/**/*.{ts,tsx}'];

export default [
  {
    files: ARCHIVOS_DINERO,
    rules: {
      'no-restricted-globals': ['error', ...globalesProhibidos],
      'no-restricted-syntax': ['error', ...SINTAXIS_DINERO],
    },
  },
  {
    files: ARCHIVOS_CONTRATOS,
    rules: {
      'no-restricted-globals': ['error', ...globalesProhibidos],
      'no-restricted-syntax': ['error', ...SINTAXIS_CONTRATOS],
    },
  },
];
