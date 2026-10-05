/**
 * Reglas de arquitectura del frontend.
 * Dirección de dependencias: app -> features -> shared.
 * Los componentes de presentación no conocen la API ni la sesión.
 */
/** Código que maneja tokens y credenciales: nunca escribe en la consola. */
const CODIGO_DE_SESION = [
  'src/shared/sesion/**/*.{ts,tsx}',
  'src/shared/api/**/*.{ts,tsx}',
  'src/features/auth/**/*.{ts,tsx}',
];

const PRESENTACIONALES = [
  'src/shared/ui/**/*.{ts,tsx}',
  'src/app/shell/**/*.{ts,tsx}',
  'src/features/*/components/**/*.{ts,tsx}',
];

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../../*', '../../../*'],
              message:
                'Usa el alias @/ en lugar de rutas relativas hacia arriba.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML está prohibido.',
        },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../../*', '../../../*'],
              message:
                'Usa el alias @/ en lugar de rutas relativas hacia arriba.',
            },
            {
              group: ['@/app/*', '@/features/*'],
              message: 'shared no puede depender de app ni de features.',
            },
          ],
        },
      ],
    },
  },
  {
    files: PRESENTACIONALES,
    ignores: ['src/app/shell/ShellLayout.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../../*', '../../../*'],
              message:
                'Usa el alias @/ en lugar de rutas relativas hacia arriba.',
            },
            {
              group: [
                '@/shared/api',
                '@/shared/api/*',
                '@/shared/sesion',
                '@/shared/sesion/*',
              ],
              message:
                'Los componentes de presentación reciben datos por props; no importan la API ni la sesión.',
            },
          ],
        },
      ],
    },
  },
  {
    files: CODIGO_DE_SESION,
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: { 'no-console': 'error' },
  },
];
