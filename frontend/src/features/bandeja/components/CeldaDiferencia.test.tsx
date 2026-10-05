import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CeldaDiferencia } from './CeldaDiferencia';

function celda(contenedor: HTMLElement) {
  return contenedor.firstElementChild as HTMLElement;
}

describe('CeldaDiferencia', () => {
  it('cero se atenúa y no agrega texto oculto', () => {
    const { container } = render(<CeldaDiferencia valor="0.0000" />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(celda(container)).toHaveAttribute('data-clase', 'cero');
    expect(celda(container).className).toMatch(/atenuada/);
    expect(container.querySelector('.solo-lectores')).toBeNull();
  });

  it('0.0040 muestra $0.00 resaltado con "menor a un centavo" oculto', () => {
    const { container } = render(<CeldaDiferencia valor="0.0040" />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(celda(container)).toHaveAttribute('data-clase', 'subcentavo');
    expect(celda(container).className).toMatch(/resaltada/);
    const oculto = screen.getByText('menor a un centavo');
    expect(oculto).toHaveClass('solo-lectores');
  });

  it('-0.0040 es lo mismo y nunca muestra un cero negativo', () => {
    const { container } = render(<CeldaDiferencia valor="-0.0040" />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[-−]/);
    expect(screen.getByText('menor a un centavo')).toBeInTheDocument();
  });

  it('0.0050 ya es $0.01: resaltado y sin texto oculto', () => {
    const { container } = render(<CeldaDiferencia valor="0.0050" />);
    expect(screen.getByText('$0.01')).toBeInTheDocument();
    expect(celda(container).className).toMatch(/resaltada/);
    expect(container.querySelector('.solo-lectores')).toBeNull();
  });

  it('0.4000 muestra $0.40 resaltado', () => {
    const { container } = render(<CeldaDiferencia valor="0.4000" />);
    expect(screen.getByText('$0.40')).toBeInTheDocument();
    expect(celda(container).className).toMatch(/resaltada/);
  });

  it('una diferencia negativa conserva el signo menos', () => {
    render(<CeldaDiferencia valor="-0.5000" />);
    expect(screen.getByText('−$0.50')).toBeInTheDocument();
  });

  it.each([null, undefined, 'abc'])(
    'sin dato (%j) muestra un guion',
    (valor) => {
      const { container } = render(<CeldaDiferencia valor={valor} />);
      expect(container).toHaveTextContent(/^—$/);
      expect(celda(container)).toHaveAttribute('data-clase', 'sin_dato');
    },
  );
});
