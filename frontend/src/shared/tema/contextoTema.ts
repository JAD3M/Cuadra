import { createContext } from 'react';
import type { Preferencia, TemaResuelto } from './tipos';

export interface ValorTema {
  preferencia: Preferencia;
  resuelto: TemaResuelto;
  setPreferencia: (preferencia: Preferencia) => void;
}

export const ContextoTema = createContext<ValorTema | null>(null);
