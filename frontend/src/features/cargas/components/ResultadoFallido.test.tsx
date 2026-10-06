import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoFallido } from './ResultadoFallido';

describe('ResultadoFallido', () => {
  it('muestra solo el aviso fijo de falla del mockup, con su icono', () => {
    const { container } = render(<ResultadoFallido />);
    expect(
      screen.getByText(
        'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.',
      ),
    ).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('no lleva la etiqueta Fallida ni más texto que el aviso', () => {
    const { container } = render(<ResultadoFallido />);
    expect(screen.queryByText('Fallida')).toBeNull();
    expect(container.querySelectorAll('strong')).toHaveLength(0);
    expect(container.textContent).toBe(
      'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.',
    );
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
