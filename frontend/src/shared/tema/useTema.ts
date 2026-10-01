import { useContext } from 'react';
import { ContextoTema, type ValorTema } from './contextoTema';

export function useTema(): ValorTema {
  const valor = useContext(ContextoTema);
  if (!valor) throw new Error('useTema debe usarse dentro de <ThemeProvider>');
  return valor;
}
