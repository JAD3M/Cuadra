import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoFallido } from './ResultadoFallido';

describe('ResultadoFallido', () => {
  it('muestra la etiqueta Fallida y el aviso de falla del mockup', () => {
    render(<ResultadoFallido errorMensaje={null} />);
    expect(screen.getByText('Fallida')).toBeInTheDocument();
    expect(
      screen.getByText(
        'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.',
      ),
    ).toBeInTheDocument();
  });

  it('el errorMensaje del servidor es texto plano', () => {
    const { container } = render(
      <ResultadoFallido errorMensaje="<b>no se pudo</b>" />,
    );
    expect(screen.getByText('<b>no se pudo</b>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('sin errorMensaje no hay línea de detalle', () => {
    const { container } = render(<ResultadoFallido errorMensaje={null} />);
    expect(container.querySelector('[data-detalle]')).toBeNull();
    const vacio = render(<ResultadoFallido errorMensaje="" />);
    expect(vacio.container.querySelector('[data-detalle]')).toBeNull();
  });

  it('no lista archivos ni ofrece botones', () => {
    render(<ResultadoFallido errorMensaje="x" />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no abre su propio alert dentro de la región de estado', () => {
    render(<ResultadoFallido errorMensaje={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
