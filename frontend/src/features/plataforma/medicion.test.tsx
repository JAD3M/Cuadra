import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  desacuerdoPlataformaFalla,
  fraccionesPlataformaFalla,
  sembrarBancosPlataforma,
  sembrarDesacuerdoPlataforma,
  sembrarFraccionesPlataforma,
  sesionPlataformaAbierta,
  sesionDeEmpresaEnPlataforma,
  usarHandlersPlataforma,
  type DesacuerdoSimulado,
  type FraccionesSimuladas,
} from '@/test/handlersPlataforma';
import { montarPlataforma } from '@/test/montarRutas';
import { servidor } from '@/test/servidor';

const EMPRESA_A = '00000000-0000-4000-8000-0000000000a1';
const EMPRESA_B = '00000000-0000-4000-8000-0000000000b2';
const EMPRESA_C = '00000000-0000-4000-8000-0000000000c3';

const DESACUERDO: DesacuerdoSimulado[] = [
  {
    companyId: EMPRESA_A,
    razonSocial: 'Ferretería del Bajío',
    banco: 'bbva',
    propuestas: 240,
    tratadas: 200,
    desacuerdos: 8,
    tasa: '0.0400',
  },
  {
    companyId: EMPRESA_A,
    razonSocial: 'Ferretería del Bajío',
    banco: 'banorte',
    propuestas: 36,
    tratadas: 30,
    desacuerdos: 3,
    tasa: '0.1000',
  },
  {
    companyId: EMPRESA_B,
    razonSocial: 'Transportes de Cuautla',
    banco: null,
    propuestas: 12,
    tratadas: 0,
    desacuerdos: 0,
    tasa: null,
  },
];

const FRACCIONES: FraccionesSimuladas[] = [
  {
    companyId: EMPRESA_A,
    razonSocial: 'Ferretería del Bajío',
    facturas: { total: 40, ppd: 10 },
    movimientos: { total: 240, parcialidades: 3, comisiones: 12 },
    fraccionPpd: '0.2500',
    fraccionParcialidades: '0.0125',
    fraccionComisiones: '0.0500',
  },
  {
    companyId: EMPRESA_C,
    razonSocial: 'Distribuidora Aurora',
    facturas: { total: 0, ppd: 0 },
    movimientos: { total: 0, parcialidades: 0, comisiones: 0 },
    fraccionPpd: null,
    fraccionParcialidades: null,
    fraccionComisiones: null,
  },
];

beforeEach(() => {
  usarHandlersPlataforma();
  sesionPlataformaAbierta();
  sembrarBancosPlataforma([]);
  sembrarDesacuerdoPlataforma(DESACUERDO);
  sembrarFraccionesPlataforma(FRACCIONES);
});

const tablaDesacuerdo = () =>
  screen.findByRole('region', {
    name: 'Tasa de desacuerdo por empresa y banco',
  });
const tablaFracciones = () =>
  screen.findByRole('region', {
    name: 'Fracciones de PPD, parcialidades y comisiones por empresa',
  });

describe('plataforma: medición', () => {
  it('muestra el título y la descripción de la pantalla', async () => {
    montarPlataforma('/plataforma/medicion');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Medición' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cuánto no está de acuerdo cada equipo con Cuadra/),
    ).toBeInTheDocument();
    expect(document.title).toContain('Medición');
  });

  it('tabla de desacuerdo: columnas, banco con nombre, «Sin banco» y tasa formateada', async () => {
    montarPlataforma('/plataforma/medicion');
    expect(
      await screen.findByRole('heading', { name: 'Tasa de desacuerdo' }),
    ).toBeInTheDocument();
    const region = await tablaDesacuerdo();
    const encabezados = within(region)
      .getAllByRole('columnheader')
      .map((c) => c.textContent);
    expect(encabezados).toEqual([
      'Empresa',
      'Banco',
      'Propuestas',
      'Tratadas (muestra)',
      'Con desacuerdo',
      'Tasa',
    ]);
    const filas = within(region).getAllByRole('row').slice(1);
    expect(
      filas.map((f) =>
        within(f)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['Ferretería del Bajío', 'BBVA', '240', '200', '8', '4.00 %'],
      ['Ferretería del Bajío', 'Banorte', '36', '30', '3', '10.00 %'],
      ['Transportes de Cuautla', 'Sin banco', '12', '0', '0', '—'],
    ]);
  });

  it('ningún número pasa por flotante: 10.00 % y no 10 %', async () => {
    montarPlataforma('/plataforma/medicion');
    const region = await tablaDesacuerdo();
    expect(within(region).getByText('10.00 %')).toBeInTheDocument();
    expect(within(region).queryByText('10 %')).not.toBeInTheDocument();
    expect(within(region).queryByText('10.0 %')).not.toBeInTheDocument();
  });

  it('la tasa ausente es «—» con su explicación', async () => {
    montarPlataforma('/plataforma/medicion');
    const region = await tablaDesacuerdo();
    expect(within(region).getByText('—')).toHaveAttribute(
      'title',
      'Todavía no hay propuestas tratadas',
    );
  });

  it('indica cómo leer la muestra, sin umbral inventado', async () => {
    montarPlataforma('/plataforma/medicion');
    await tablaDesacuerdo();
    expect(
      screen.getByText(/Con pocas tratadas, un porcentaje alto dice poco/),
    ).toBeInTheDocument();
  });

  it('fracciones: porcentaje con su conteo «N de M» y PPD explicado', async () => {
    montarPlataforma('/plataforma/medicion');
    expect(
      await screen.findByRole('heading', {
        name: 'Casos difíciles por empresa',
      }),
    ).toBeInTheDocument();
    const region = await tablaFracciones();
    expect(
      within(region).getByText('pago en parcialidades o diferido'),
    ).toBeInTheDocument();
    const encabezados = within(region)
      .getAllByRole('columnheader')
      .map((c) => c.textContent);
    expect(encabezados).toEqual([
      'Empresa',
      'Facturas PPDpago en parcialidades o diferido',
      'Parcialidades',
      'Comisiones',
    ]);
    const bajio = within(region).getByRole('row', {
      name: /Ferretería del Bajío/,
    });
    const celdas = within(bajio).getAllByRole('cell');
    expect(celdas[1]).toHaveTextContent('25.00 %');
    expect(celdas[1]).toHaveTextContent('10 de 40 facturas');
    expect(celdas[2]).toHaveTextContent('1.25 %');
    expect(celdas[2]).toHaveTextContent('3 de 240 movimientos');
    expect(celdas[3]).toHaveTextContent('5.00 %');
    expect(celdas[3]).toHaveTextContent('12 de 240 movimientos');
  });

  it('una empresa sin facturas ni movimientos muestra «—» y qué falta', async () => {
    montarPlataforma('/plataforma/medicion');
    const region = await tablaFracciones();
    const aurora = within(region).getByRole('row', {
      name: /Distribuidora Aurora/,
    });
    const celdas = within(aurora).getAllByRole('cell');
    expect(celdas[1]).toHaveTextContent('—');
    expect(celdas[1]).toHaveTextContent('Sin facturas');
    expect(celdas[2]).toHaveTextContent('Sin movimientos');
    expect(celdas[3]).toHaveTextContent('Sin movimientos');
  });

  it('cargando: esqueleto con role status mientras llegan las lecturas', async () => {
    servidor.use(
      http.get('/api/plataforma/desacuerdo', async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json([]);
      }),
    );
    montarPlataforma('/plataforma/medicion');
    const estado = (await screen.findByText('Cargando la medición')).closest(
      '[role="status"]',
    );
    expect(estado).toHaveAttribute('aria-busy', 'true');
    await screen.findByRole('heading', { name: 'Tasa de desacuerdo' });
    expect(screen.queryByText('Cargando la medición')).not.toBeInTheDocument();
  });

  it('error de lectura: alerta con «Reintentar» que vuelve a pedir', async () => {
    // Un 400 no se reintenta solo (ver `reintentarConsulta`): el error sale ya.
    desacuerdoPlataformaFalla(400);
    montarPlataforma('/plataforma/medicion');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    servidor.resetHandlers();
    usarHandlersPlataforma();
    sesionPlataformaAbierta();
    sembrarDesacuerdoPlataforma(DESACUERDO);
    sembrarFraccionesPlataforma(FRACCIONES);
    await userEvent
      .setup()
      .click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(await tablaDesacuerdo()).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sin datos de desacuerdo: aviso informativo y las fracciones siguen', async () => {
    sembrarDesacuerdoPlataforma([]);
    montarPlataforma('/plataforma/medicion');
    expect(await screen.findByText('Todavía no hay datos')).toBeInTheDocument();
    expect(
      screen.getByText(/Una empresa sin propuestas no aparece/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', {
        name: 'Tasa de desacuerdo por empresa y banco',
      }),
    ).not.toBeInTheDocument();
    expect(await tablaFracciones()).toBeInTheDocument();
  });

  it('un 401 en desacuerdo termina la sesión sin mostrar el error de conexión', async () => {
    desacuerdoPlataformaFalla(401);
    const { router } = montarPlataforma('/plataforma/medicion');
    expect(
      await screen.findByText(
        'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/plataforma/login');
    expect(
      screen.queryByText('No se pudo conectar con el servidor.'),
    ).toBeNull();
  });

  it('un 403 en fracciones también termina la sesión', async () => {
    fraccionesPlataformaFalla(403);
    const { router } = montarPlataforma('/plataforma/medicion');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/plataforma/login'),
    );
    expect(
      screen.queryByText('No se pudo conectar con el servidor.'),
    ).toBeNull();
  });

  it('con la cookie de una persona de empresa (403) no se ve la medición', async () => {
    sesionDeEmpresaEnPlataforma();
    const { router } = montarPlataforma('/plataforma/medicion');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/plataforma/login'),
    );
  });
});

describe('plataforma: pestañas de la cabecera', () => {
  it('en /plataforma/medicion, «Medición» es la activa', async () => {
    montarPlataforma('/plataforma/medicion');
    const nav = await screen.findByRole('navigation', {
      name: 'Secciones de la plataforma',
    });
    expect(within(nav).getByRole('link', { name: 'Medición' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('link', { name: 'Empresas y bancos' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('en /plataforma, «Empresas y bancos» es la activa y la pantalla conserva su contenido', async () => {
    montarPlataforma('/plataforma');
    const nav = await screen.findByRole('navigation', {
      name: 'Secciones de la plataforma',
    });
    expect(
      within(nav).getByRole('link', { name: 'Empresas y bancos' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav).getByRole('link', { name: 'Medición' }),
    ).not.toHaveAttribute('aria-current');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Empresas' }),
    ).toBeInTheDocument();
  });

  it('navega entre las dos pantallas con las pestañas', async () => {
    const { router } = montarPlataforma('/plataforma');
    const usuario = userEvent.setup();
    const nav = await screen.findByRole('navigation', {
      name: 'Secciones de la plataforma',
    });
    await usuario.click(within(nav).getByRole('link', { name: 'Medición' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Medición' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/plataforma/medicion');
    await usuario.click(
      within(
        screen.getByRole('navigation', { name: 'Secciones de la plataforma' }),
      ).getByRole('link', { name: 'Empresas y bancos' }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Empresas' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/plataforma');
  });
});
