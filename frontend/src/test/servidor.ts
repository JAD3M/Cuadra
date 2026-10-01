import { setupServer } from 'msw/node';
import { handlers } from '@/test/handlers';

export const servidor = setupServer(...handlers);
