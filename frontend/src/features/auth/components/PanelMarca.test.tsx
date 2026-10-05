import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelMarca } from './PanelMarca';

describe('PanelMarca', () => {
  it('muestra la marca, el titular y la línea de apoyo exactos', () => {
    render(<PanelMarca />);
    expect(screen.getByText('Cuadra')).toBeInTheDocument();
    expect(
      screen.getByText('Cada peso del banco, con su CFDI.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'El motor de reglas propone. Tú confirmas. Nada se cierra solo.',
      ),
    ).toBeInTheDocument();
  });

  it('no tiene encabezados: el h1 de la página es el del formulario', () => {
    const { container } = render(<PanelMarca />);
    expect(within(container).queryAllByRole('heading')).toHaveLength(0);
  });

  it('no muestra ningún número ni contador', () => {
    const { container } = render(<PanelMarca />);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('el logotipo es decorativo', () => {
    const { container } = render(<PanelMarca />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('no tiene elementos interactivos', () => {
    const { container } = render(<PanelMarca />);
    expect(
      container.querySelectorAll('a, button, input, [tabindex]'),
    ).toHaveLength(0);
  });
});
