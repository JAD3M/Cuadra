import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTEXTO_SESION, capacidadesDeRoles } from '@/test/fixtures';
import { elegirEmpresaMock, hayEmpresaElegida } from '@/test/sesionMock';
import { entrarALaApp, montarApp } from '@/test/montarApp';
import { servidor } from '@/test/servidor';

beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

/** La sesión entrega estos roles y las capacidades que el servidor derivaría. */
function conRoles(roles: string[]) {
  const contexto = () => ({
    ...CONTEXTO_SESION,
    roles,
    capacidades: capacidadesDeRoles(roles),
  });
  servidor.use(
    http.post('/api/auth/empresa/:id', ({ params }) => {
      elegirEmpresaMock(String(params.id));
      return HttpResponse.json(contexto());
    }),
    http.get('/api/auth/contexto', () =>
      hayEmpresaElegida()
        ? HttpResponse.json(contexto())
        : HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: 'x' },
            { status: 401 },
          ),
    ),
  );
}

const menu = () => screen.getByRole('navigation');

const TASA = { propuestas: 240, tratadas: 200, desacuerdos: 8, tasa: '0.0400' };

function medicionResponde(cuerpo: object, pedidas: { n: number } = { n: 0 }) {
  servidor.use(
    http.get('/api/medicion/desacuerdo', () => {
      pedidas.n++;
      return HttpResponse.json(cuerpo);
    }),
  );
  return pedidas;
}

describe('flujos de la medición (historia 9.1)', () => {
  it('el administrador ve «Medición» entre Tolerancia y Usuarios y entra a la pantalla', async () => {
    medicionResponde(TASA);
    montarApp('/bandeja');
    await entrarALaApp();
    const etiquetas = within(menu())
      .getAllByRole('link')
      .map((l) => l.textContent?.trim());
    expect(etiquetas.indexOf('Medición')).toBe(
      etiquetas.indexOf('Tolerancia') + 1,
    );
    expect(etiquetas.indexOf('Usuarios')).toBe(
      etiquetas.indexOf('Medición') + 1,
    );

    await userEvent
      .setup()
      .click(within(menu()).getByRole('link', { name: 'Medición' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Medición' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/propuestas de la regla 1$/)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Medición · Cuadra'));
    expect(
      within(menu()).getByRole('link', { name: 'Medición' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('muestra la tasa, las tres cifras y cómo se cuenta', async () => {
    medicionResponde(TASA);
    montarApp('/medicion');
    await entrarALaApp();
    const tarjeta = await screen.findByRole('region', {
      name: 'Tasa de desacuerdo',
    });
    expect(await within(tarjeta).findByText('4.00 %')).toBeInTheDocument();
    expect(
      within(tarjeta).getByText(
        'de las propuestas de la regla 1 ya tratadas tuvieron desacuerdo.',
      ),
    ).toBeInTheDocument();
    const cifras: Array<[string, string]> = [
      ['Propuestas hechas', '240'],
      ['Tratadas por el equipo', '200'],
      ['Con desacuerdo', '8'],
    ];
    for (const [rotulo, cifra] of cifras) {
      const dato = within(tarjeta).getByText(rotulo).parentElement!;
      expect(within(dato).getByText(cifra)).toBeInTheDocument();
    }
    const como = screen.getByRole('region', { name: 'Cómo se cuenta' });
    expect(
      within(como).getByText(
        'La tasa se calcula con los eventos de tu empresa cada vez que abres esta pantalla; no es un número guardado.',
      ),
    ).toBeInTheDocument();
  });

  it('una tasa en cero con propuestas tratadas es un 0.00 % real', async () => {
    medicionResponde({ ...TASA, desacuerdos: 0, tasa: '0.0000' });
    montarApp('/medicion');
    await entrarALaApp();
    expect(await screen.findByText('0.00 %')).toBeInTheDocument();
  });

  it('sin propuestas dice que aún no hay datos y no pinta un cero', async () => {
    medicionResponde({
      propuestas: 0,
      tratadas: 0,
      desacuerdos: 0,
      tasa: null,
    });
    montarApp('/medicion');
    await entrarALaApp();
    expect(await screen.findByText('Todavía no hay datos')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('con propuestas pero ninguna tratada lo dice con el total, sin tasa', async () => {
    medicionResponde({
      propuestas: 12,
      tratadas: 0,
      desacuerdos: 0,
      tasa: null,
    });
    montarApp('/medicion');
    await entrarALaApp();
    expect(
      await screen.findByText('Todavía no hay propuestas tratadas'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cuadra ya hizo/)).toHaveTextContent(
      '12 propuestas',
    );
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('si falla ofrece Reintentar y al reintentar muestra la tasa', async () => {
    let falla = true;
    servidor.use(
      http.get('/api/medicion/desacuerdo', () =>
        falla
          ? HttpResponse.json(
              { statusCode: 500, message: 'x' },
              { status: 500 },
            )
          : HttpResponse.json(TASA),
      ),
    );
    montarApp('/medicion');
    await entrarALaApp();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    falla = false;
    await userEvent
      .setup()
      .click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('4.00 %')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([['contador'], ['revisor'], ['auditor']])(
    'con el rol %s el menú no trae «Medición» y la ruta directa muestra sin permiso',
    async (rol) => {
      conRoles([rol]);
      const pedidas = medicionResponde(TASA);
      montarApp('/medicion');
      await entrarALaApp();
      expect(
        await screen.findByText('No tienes permiso para esta acción.'),
      ).toBeInTheDocument();
      expect(
        within(menu()).queryByRole('link', { name: 'Medición' }),
      ).toBeNull();
      expect(screen.queryByText('4.00 %')).toBeNull();
      // Sin `medicion.ver` ni siquiera se pide la medición.
      expect(pedidas.n).toBe(0);
    },
  );
});
