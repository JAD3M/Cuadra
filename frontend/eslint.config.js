import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import arquitectura from './eslint/arquitectura.js';

// jsx-a11y no se incluye: su rango de peers llega hasta ESLint 9 y este
// proyecto usa ESLint 10 (ver bitácora de CU-20).
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  ...arquitectura,
  prettier,
);
