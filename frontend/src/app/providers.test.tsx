import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useTema } from '@/shared/tema';
import { Providers } from './providers';
import { useSessionContext } from './session';

function Sonda() {
  const cliente = useQueryClient();
  const { preferencia, setPreferencia } = useTema();
  const sesion = useSessionContext();
  return (
    <div>
      <p data-testid="refetch">
        {String(cliente.getDefaultOptions().queries?.refetchOnWindowFocus)}
      </p>
      <p data-testid="preferencia">{preferencia}</p>
      <p data-testid="sesion">{sesion.status}</p>
      <button type="button" onClick={() => setPreferencia('light')}>
        Claro
      </button>
    </div>
  );
}

describe('Providers', () => {
  it('monta el cliente de consultas creado por crearQueryClient', () => {
    render(
      <Providers>
        <Sonda />
      </Providers>,
    );
    expect(screen.getByTestId('refetch')).toHaveTextContent('false');
  });

  it('monta el tema: el hook funciona y aplica data-theme', async () => {
    render(
      <Providers>
        <Sonda />
      </Providers>,
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Claro' }));
    expect(screen.getByTestId('preferencia')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('monta la sesión provisional en ready', () => {
    render(
      <Providers>
        <Sonda />
      </Providers>,
    );
    expect(screen.getByTestId('sesion')).toHaveTextContent('ready');
  });

  it('conserva el mismo cliente de consultas entre renders', () => {
    const clientes: unknown[] = [];
    function Captura() {
      clientes.push(useQueryClient());
      return null;
    }
    const { rerender } = render(
      <Providers>
        <Captura />
      </Providers>,
    );
    rerender(
      <Providers>
        <Captura />
      </Providers>,
    );
    expect(new Set(clientes).size).toBe(1);
  });
});
