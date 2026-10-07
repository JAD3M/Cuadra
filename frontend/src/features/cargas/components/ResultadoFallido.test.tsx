import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoFallido } from './ResultadoFallido';

describe('ResultadoFallido', () => {
  it('muestra el aviso fijo de falla del mockup, con su icono', () => {
    const { container } = render(<ResultadoFallido />);
    expect(
      screen.getByText(
        'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.',
      ),
    ).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('lleva el chip Fallida en tono peligro sobre el aviso y no más texto', () => {
    const { container } = render(<ResultadoFallido />);
    const chip = screen.getByText('Fallida');
    expect(chip).toHaveAttribute('data-tono', 'peligro');
    expect(container.textContent).toBe(
      'Fallida' +
        'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.',
    );
    const aviso = screen.getByText(/^La carga falló/);
    expect(
      chip.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('no lista archivos ni ofrece botones', () => {
    render(<ResultadoFallido />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no abre su propio alert dentro de la región de estado', () => {
    render(<ResultadoFallido />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
