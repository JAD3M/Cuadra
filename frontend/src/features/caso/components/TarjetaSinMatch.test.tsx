import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TarjetaSinMatch } from './TarjetaSinMatch';

describe('TarjetaSinMatch', () => {
  it('muestra el título y los dos párrafos de la maqueta', () => {
    render(<TarjetaSinMatch regla={null} motivo={null} />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Sin match' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'El motor no encontró un CFDI seguro para este movimiento.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Este caso no tiene propuestas que confirmar.'),
    ).toBeInTheDocument();
  });

  it('muestra el motivo y el código de la regla del servidor tal cual', () => {
    render(
      <TarjetaSinMatch
        regla="monto_multiples_candidatos"
        motivo="Hay varios CFDI con el mismo monto"
      />,
    );
    expect(
      screen.getByText('Hay varios CFDI con el mismo monto'),
    ).toBeInTheDocument();
    expect(screen.getByText('monto_multiples_candidatos')).toBeInTheDocument();
  });

  it('una regla desconocida se muestra verbatim', () => {
    render(<TarjetaSinMatch regla="regla_nueva" motivo={null} />);
    expect(screen.getByText('regla_nueva')).toBeInTheDocument();
  });

  it('sin motivo ni regla no deja huecos ni escribe «null»', () => {
    render(<TarjetaSinMatch regla={null} motivo={null} />);
    expect(screen.queryByText(/null/)).toBeNull();
    expect(screen.getAllByText(/\S/)).toHaveLength(3);
  });

  it('es solo lectura: sin tarjeta de CFDI, lista ni controles', () => {
    render(<TarjetaSinMatch regla={null} motivo={null} />);
    expect(screen.queryByText('CFDI candidato')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Confirmar/)).toBeNull();
    expect(screen.queryByText(/Rechazar/)).toBeNull();
  });
});
