import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AVISOS } from '@/features/auth/components/textos';
import { casoFalla } from '@/test/handlersCaso';
import { entrarALaApp, montarApp } from '@/test/montarApp';
import { servidor } from '@/test/servidor';

// Montar la app completa y teclear el login tarda más que una pantalla suelta.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

describe('errores de lectura del caso en la app', () => {
  it('un 401 al leer el caso termina la sesión y guarda /casos/{id} como destino (AUT-12)', async () => {
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    await screen.findByRole('table');
    const enlace = within(screen.getByRole('table')).getAllByRole('link')[0];
    const href = enlace?.getAttribute('href') ?? '';
    expect(href).toMatch(/^\/casos\//);

    servidor.use(casoFalla(401));
    await userEvent.setup().click(enlace!);
    await screen.findByText(AVISOS.sesion_expirada);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.state).toMatchObject({
      from: { pathname: href },
    });
  });
});
