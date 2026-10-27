import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConfigPolling } from '@/features/cargas/ContextoPolling';
import { CONTEXTO_SESION, capacidadesDeRoles } from '@/test/fixtures';
import { espiarSolicitudes } from '@/test/handlersAuth';
import {
  subidaCfdiConMonedaNoSoportada,
  subidaEstadoCuentaMonedaNoMxn,
} from '@/test/handlersCargas';
import { entrarALaApp, montarApp } from '@/test/montarApp';
import { servidor } from '@/test/servidor';
import { elegirEmpresaMock, hayEmpresaElegida } from '@/test/sesionMock';

// Historia 3.1, pantalla: la marca de moneda, el rechazo por moneda y el menú
// por rol. Montar la app completa y teclear el login tarda más que una pantalla.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

const POLLING: ConfigPolling = { intervaloMs: 15, topeMs: 10_000 };

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
const usuario = () => userEvent.setup({ applyAccept: false });
const LEYENDA =
  '⚠ Se guardó, pero Cuadra no concilia monedas distintas de MXN.';

describe.each([['admin'], ['contador']])('cargas con moneda: %s', (rol) => {
  it('el menú trae Cargas y la ruta directa abre la pantalla', async () => {
    conRoles([rol]);
    montarApp('/cargas', { polling: POLLING });
    await entrarALaApp();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cargas' }),
    ).toBeInTheDocument();
    expect(
      within(menu()).getByRole('link', { name: 'Cargas' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
  });

  it('un CFDI en USD y EUR se muestra «Procesada» con su marca por archivo y la leyenda', async () => {
    conRoles([rol]);
    servidor.use(...subidaCfdiConMonedaNoSoportada());
    montarApp('/cargas', { polling: POLLING });
    await entrarALaApp();
    await screen.findByRole('table');
    const u = usuario();
    await u.upload(
      screen.getByLabelText('Elegir archivos'),
      ['factura-usd.xml', 'factura-eur.xml', 'factura-mxn.xml'].map(
        (n) => new File(['<c/>'], n),
      ),
    );
    await u.click(screen.getByRole('button', { name: 'Subir 3 archivos' }));
    const tarjeta = screen.getByRole('region', { name: 'CFDI · XML' });
    const usd = await within(tarjeta).findByText('⚠ Moneda no soportada · USD');
    expect(usd.closest('li')).toHaveTextContent('factura-usd.xml');
    const eur = within(tarjeta).getByText('⚠ Moneda no soportada · EUR');
    expect(eur.closest('li')).toHaveTextContent('factura-eur.xml');
    const mxn = within(tarjeta)
      .getByText('factura-mxn.xml')
      .closest('li') as HTMLElement;
    expect(mxn).not.toHaveTextContent('Moneda no soportada');
    expect(within(tarjeta).getAllByText(LEYENDA)).toHaveLength(1);
    // La carga como un todo sigue contando como procesada: 3 nuevos, 0 con error.
    expect(tarjeta).toHaveTextContent('3 nuevos, 0 ya existían, 0 con error.');
  });

  it('un estado de cuenta que no está en MXN se rechaza con el motivo, en una alerta enfocada', async () => {
    conRoles([rol]);
    servidor.use(subidaEstadoCuentaMonedaNoMxn());
    montarApp('/cargas', { polling: POLLING });
    await entrarALaApp();
    await screen.findByRole('table');
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Perfil de lectura') as HTMLSelectElement)
          .options.length,
      ).toBe(3),
    );
    const u = usuario();
    await u.upload(
      screen.getByLabelText('Elegir archivo'),
      new File(['a,b'], 'estado-usd.csv'),
    );
    await u.click(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    );
    const tarjeta = screen.getByRole('region', { name: 'Estado de cuenta' });
    const alerta = await within(tarjeta).findByRole('alert');
    expect(alerta).toHaveTextContent('Archivo rechazado');
    expect(alerta).toHaveTextContent(
      'El estado de cuenta no está en MXN. Cuadra solo procesa estados de cuenta en pesos mexicanos.',
    );
    await waitFor(() => expect(alerta).toHaveFocus());
    // La selección sigue, para poder corregir el archivo.
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeEnabled();
  });
});

describe.each([['revisor'], ['auditor']])('cargas con moneda: %s', (rol) => {
  it('el menú no trae Cargas y la ruta directa no ofrece los formularios ni pide nada', async () => {
    const espia = espiarSolicitudes();
    conRoles([rol]);
    montarApp('/cargas', { polling: POLLING });
    await entrarALaApp();
    expect(
      await screen.findByText('No tienes permiso para esta acción.'),
    ).toBeInTheDocument();
    expect(within(menu()).queryByRole('link', { name: 'Cargas' })).toBeNull();
    expect(screen.queryByLabelText('Elegir archivos')).toBeNull();
    expect(screen.queryByLabelText('Elegir archivo')).toBeNull();
    expect(screen.queryByRole('button', { name: /Subir/ })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen.queryByText('Tu rol solo permite consultar las cargas.'),
    ).toBeNull();
    // Sin `cargas.ver` ni siquiera se pide la lista.
    expect(espia.cuantas('GET', '/api/cargas')).toBe(0);
    espia.detener();
  });
});
