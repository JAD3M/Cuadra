import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { propuestaCaso } from '@/test/fixturesCaso';
import { DetallePropuesta } from './DetallePropuesta';

describe('DetallePropuesta', () => {
  it('compone CFDI, diferencia y motor de la propuesta expandida', () => {
    render(
      <DetallePropuesta
        propuesta={propuestaCaso(1, { diferenciaMonto: '-0.3000' })}
        toleranciaMonto="0.5000"
      />,
    );
    expect(screen.getByText('CFDI candidato')).toBeInTheDocument();
    expect(screen.getByText('Diferencia')).toBeInTheDocument();
    expect(screen.getByText('Por qué el motor lo propone')).toBeInTheDocument();
    expect(
      screen.getByText('Dentro de la tolerancia de la empresa'),
    ).toBeInTheDocument();
  });
});
