import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarcadorPendiente } from './MarcadorPendiente';

describe('MarcadorPendiente', () => {
  it('muestra el nombre de la pantalla como h1 por omisión', () => {
    render(<MarcadorPendiente titulo="Cargas" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cargas' }),
    ).toBeInTheDocument();
  });

  it('usa h2 cuando el shell ya aporta el h1', () => {
    render(<MarcadorPendiente titulo="Cargas" nivel={2} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cargas' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('avisa en español neutro que la pantalla está en construcción', () => {
    render(<MarcadorPendiente titulo="Cargas" />);
    expect(screen.getByText(/Pantalla en construcción/)).toBeInTheDocument();
  });

  it('no menciona números de historia ni inventa datos', () => {
    const { container } = render(<MarcadorPendiente titulo="Bitácora" />);
    expect(container.textContent).not.toMatch(/CU-\d+/);
    expect(container.querySelector('table')).toBeNull();
  });

  it('no declara landmarks: el main lo pone quien la contiene', () => {
    render(<MarcadorPendiente titulo="Cargas" />);
    expect(screen.queryByRole('main')).toBeNull();
  });

  it('renderiza datos adicionales debajo del aviso', () => {
    render(
      <MarcadorPendiente titulo="Detalle del caso">
        <p>Caso abc</p>
      </MarcadorPendiente>,
    );
    expect(screen.getByText('Caso abc')).toBeInTheDocument();
  });
});
