import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Con `globals: false` Testing Library no registra su limpieza sola.
afterEach(() => {
  cleanup();
});
