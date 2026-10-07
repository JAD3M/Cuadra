import { screen, waitFor, within } from '@testing-library/react';
import { expect } from 'vitest';

// Desde que la lista de cambios comparte pantalla con el valor, un monto como
// «$0.50» sale también en las filas (antes -> despues). Las pruebas del valor
// vigente miran SOLO la tarjeta «Valor actual»: ahí está el valor que manda.

/** La tarjeta «Valor actual» (una sección con su encabezado como nombre). */
export const tarjetaValor = () =>
  screen.getByRole('region', { name: 'Valor actual' });

/** Espera a que la tarjeta del valor muestre `texto` y devuelve ese elemento. */
export const esperarValor = (texto: string) =>
  waitFor(() => {
    const elemento = within(tarjetaValor()).getByText(texto);
    expect(elemento).toBeInTheDocument();
    return elemento;
  });

/** El elemento de `texto` dentro de la tarjeta del valor, o error si no está. */
export const valorEnTarjeta = (texto: string) =>
  within(tarjetaValor()).getByText(texto);

/** El elemento de `texto` dentro de la tarjeta del valor, o `null`. */
export const valorAusente = (texto: string) =>
  within(tarjetaValor()).queryByText(texto);
