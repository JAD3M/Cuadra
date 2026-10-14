import { useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useTema } from '@/shared/tema';
import { sesionConEmpresa } from '@/test/sesionMock';
import { servidor } from '@/test/servidor';
import { Providers } from './providers';
import { useSessionContext } from '@/shared/sesion';

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

  it('monta la sesión real: pregunta al servidor y, sin cookie, queda anónima', async () => {
    render(
      <Providers>
        <Sonda />
      </Providers>,
    );
    expect(screen.getByTestId('sesion')).toHaveTextContent('restoring');
    await waitFor(() =>
      expect(screen.getByTestId('sesion')).toHaveTextContent('anonymous'),
    );
  });

  it('recargar con la cookie vigente restaura la sesión sin pedir login', async () => {
    sesionConEmpresa();
    render(
      <Providers>
        <Sonda />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('sesion')).toHaveTextContent('ready'),
    );
  });

  it('en /plataforma no restaura la sesión de empresa ni llama a /auth', async () => {
    const urls: string[] = [];
    const registrar = ({ request }: { request: Request }) => {
      urls.push(new URL(request.url).pathname);
    };
    servidor.events.on('request:start', registrar);
    window.history.pushState({}, '', '/plataforma');
    try {
      render(
        <Providers>
          <p>pantalla de plataforma</p>
        </Providers>,
      );
      expect(screen.getByText('pantalla de plataforma')).toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(urls.filter((u) => u.includes('/auth/'))).toEqual([]);
    } finally {
      servidor.events.removeListener('request:start', registrar);
      window.history.pushState({}, '', '/');
    }
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
