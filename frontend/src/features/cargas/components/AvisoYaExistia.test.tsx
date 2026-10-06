import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoYaExistia } from './AvisoYaExistia';

describe('AvisoYaExistia', () => {
  it('terminada: las dos frases, cada una en su elemento', () => {
    render(
      <AvisoYaExistia
        frases={['Este archivo ya se había cargado.', 'No se duplicó nada.']}
      />,
    );
    expect(
      screen.getByText('Este archivo ya se había cargado.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No se duplicó nada.')).toBeInTheDocument();
  });

  it('en cola: una sola frase y no la otra', () => {
    render(
      <AvisoYaExistia
        frases={[
          'Este archivo ya se había cargado y se volvió a poner en la cola.',
        ]}
      />,
    );
    expect(
      screen.getByText(
        'Este archivo ya se había cargado y se volvió a poner en la cola.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('No se duplicó nada.')).toBeNull();
  });

  it('el icono es decorativo y no abre una región propia', () => {
    const { container } = render(<AvisoYaExistia frases={['x']} />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
