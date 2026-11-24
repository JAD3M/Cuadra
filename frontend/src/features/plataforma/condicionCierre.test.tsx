import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONDICION_SIN_DATOS,
  condicionPlataformaFalla,
  sembrarCondicionPlataforma,
  sembrarBancosPlataforma,
  sesionPlataformaAbierta,
  usarHandlersPlataforma,
  type CondicionSimulada,
} from '@/test/handlersPlataforma';
import { montarPlataforma } from '@/test/montarRutas';
import { servidor } from '@/test/servidor';

const criterio = (pide: number, hoy: number) => ({
  pide,
  hoy,
  falta: hoy >= pide ? 0 : pide - hoy,
  cumple: hoy >= pide,
});

// Los tres estados del mockup 20 (y 21, en claro).
const NO_CUMPLE: CondicionSimulada = {
  cumple: false,
  criterios: {
    propuestas: criterio(1000, 350),
    empresas: criterio(3, 3),
    meses: criterio(3, 2),
  },
  tasa: {
    registradas: { casos: 283, desacuerdos: 14, tasa: '0.0495' },
    muestra: { casos: 40, desacuerdos: 1, tasa: '0.0250' },
    usada: 'registradas',
    tasaUsada: '0.0495',
    exceso: '0.0445',
    maxima: '0.0050',
    cumple: false,
  },
};

const CUMPLE: CondicionSimulada = {
  cumple: true,
  criterios: {
    propuestas: criterio(1000, 1240),
    empresas: criterio(3, 4),
    meses: criterio(3, 4),
  },
  tasa: {
    registradas: { casos: 940, desacuerdos: 3, tasa: '0.0032' },
    muestra: { casos: 250, desacuerdos: 1, tasa: '0.0040' },
    usada: 'muestra',
    tasaUsada: '0.0040',
    exceso: '0.0000',
    maxima: '0.0050',
    cumple: true,
  },
};

beforeEach(() => {
  usarHandlersPlataforma();
  sesionPlataformaAbierta();
  sembrarBancosPlataforma([]);
  sembrarCondicionPlataforma(NO_CUMPLE);
});

const seccion = () =>
  screen.findByRole('region', {
    name: 'Condición para considerar el cierre automático',
  });

const TITULO = 'Condición para considerar el cierre automático';

describe('plataforma: condición para considerar el cierre automático (9.5)', () => {
  it('sale después de «Casos difíciles por empresa», con su descripción', async () => {
    montarPlataforma('/plataforma/medicion');
    const region = await seccion();
    const titulos = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(titulos).toEqual([
      'Tasa de desacuerdo',
      'Casos difíciles por empresa',
      TITULO,
    ]);
    expect(
      within(region).getByText(/Si los datos de todas las empresas cumplen/),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(/no es un resultado guardado/),
    ).toBeInTheDocument();
  });

  it('no cumple: dice qué falta en el resumen', async () => {
    montarPlataforma('/plataforma/medicion');
    const region = await seccion();
    expect(
      within(region).getByText('La condición todavía no se cumple'),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        'Faltan 650 propuestas y 1 mes de datos, y la tasa de desacuerdo supera el límite de 0.50 %.',
      ),
    ).toBeInTheDocument();
    expect(
      within(region).queryByText('La condición se cumple con los datos de hoy'),
    ).not.toBeInTheDocument();
  });

  it('no cumple: tabla de umbrales con se pide, hoy, falta y estado de cada uno', async () => {
    montarPlataforma('/plataforma/medicion');
    const tabla = await screen.findByRole('region', {
      name: 'Umbrales de la condición para considerar el cierre automático',
    });
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Criterio', 'Se pide', 'Hoy', 'Falta', 'Estado']);
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(
      filas.map((f) =>
        within(f)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      [
        'Propuestas de la regla 1En todas las empresas',
        '≥ 1,000',
        '350',
        '650',
        '✕ No cumple',
      ],
      [
        'Empresas distintasCon al menos una propuesta',
        '≥ 3',
        '3',
        '0',
        '✓ Cumple',
      ],
      [
        'Meses con propuestasMeses distintos con datos',
        '≥ 3',
        '2',
        '1',
        '✕ No cumple',
      ],
      [
        'Tasa de desacuerdoLa más alta de las dos medidas',
        '≤ 0.50 %',
        '4.95 %',
        '4.45 puntos de más',
        '✕ No cumple',
      ],
    ]);
  });

  it('las dos tasas, por separado y con su conteo; solo una dice que se usa', async () => {
    montarPlataforma('/plataforma/medicion');
    const region = await seccion();
    expect(
      within(region).getByRole('heading', {
        level: 3,
        name: 'Tasa de desacuerdo, en las dos medidas',
      }),
    ).toBeInTheDocument();
    const registradas = within(region).getByRole('group', {
      name: 'Respuestas registradas',
    });
    expect(registradas).toHaveTextContent('4.95 %');
    expect(registradas).toHaveTextContent(
      '14 desacuerdos en 283 propuestas tratadas',
    );
    expect(registradas).toHaveTextContent('Se usa esta en la condición');
    const muestra = within(region).getByRole('group', {
      name: 'Muestra verificada',
    });
    expect(muestra).toHaveTextContent('2.50 %');
    expect(muestra).toHaveTextContent('1 desacuerdo en 40 casos verificados');
    expect(muestra).not.toHaveTextContent('Se usa esta en la condición');
    expect(
      within(region).getAllByText('Se usa esta en la condición'),
    ).toHaveLength(1);
  });

  it('cumple: aviso verde, todo «Cumple», «Dentro del límite» y la muestra es la usada', async () => {
    sembrarCondicionPlataforma(CUMPLE);
    montarPlataforma('/plataforma/medicion');
    const region = await seccion();
    expect(
      within(region).getByText('La condición se cumple con los datos de hoy'),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        'Es solo información. No activa nada y no cambia ninguna regla.',
      ),
    ).toBeInTheDocument();
    expect(
      within(region).queryByText('La condición todavía no se cumple'),
    ).not.toBeInTheDocument();
    const tabla = within(region).getByRole('region', {
      name: 'Umbrales de la condición para considerar el cierre automático',
    });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(
      filas.map((f) =>
        within(f)
          .getAllByRole('cell')
          .slice(1)
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['≥ 1,000', '1,240', '0', '✓ Cumple'],
      ['≥ 3', '4', '0', '✓ Cumple'],
      ['≥ 3', '4', '0', '✓ Cumple'],
      ['≤ 0.50 %', '0.40 %', 'Dentro del límite', '✓ Cumple'],
    ]);
    expect(
      within(region).getByRole('group', { name: 'Muestra verificada' }),
    ).toHaveTextContent('Se usa esta en la condición');
    expect(
      within(region).getByRole('group', { name: 'Respuestas registradas' }),
    ).not.toHaveTextContent('Se usa esta en la condición');
  });

  it('sin datos: ceros, tasas «—», «Sin casos todavía» y ninguna tasa usada', async () => {
    sembrarCondicionPlataforma(CONDICION_SIN_DATOS);
    montarPlataforma('/plataforma/medicion');
    const region = await seccion();
    expect(
      within(region).getByText(
        'Aún no hay propuestas de la regla 1 ni casos verificados.',
      ),
    ).toBeInTheDocument();
    const tabla = within(region).getByRole('region', {
      name: 'Umbrales de la condición para considerar el cierre automático',
    });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(
      filas.map((f) =>
        within(f)
          .getAllByRole('cell')
          .slice(1)
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['≥ 1,000', '0', '1,000', '✕ No cumple'],
      ['≥ 3', '0', '3', '✕ No cumple'],
      ['≥ 3', '0', '3', '✕ No cumple'],
      ['≤ 0.50 %', '—', 'Sin casos todavía', '✕ No cumple'],
    ]);
    const registradas = within(region).getByRole('group', {
      name: 'Respuestas registradas',
    });
    expect(registradas).toHaveTextContent('—');
    expect(registradas).toHaveTextContent('Sin propuestas tratadas');
    expect(
      within(region).getByRole('group', { name: 'Muestra verificada' }),
    ).toHaveTextContent('Sin casos verificados');
    expect(
      within(region).queryByText('Se usa esta en la condición'),
    ).not.toBeInTheDocument();
    expect(
      within(region).getByText(
        'Una tasa sin casos no cuenta como cumplida: sin datos, el criterio de la tasa no se cumple.',
      ),
    ).toBeInTheDocument();
  });

  it('solo informa: lo dice y no ofrece activar nada', async () => {
    sembrarCondicionPlataforma(CUMPLE);
    montarPlataforma('/plataforma/medicion');
    const region = await seccion();
    const nota = within(region).getByRole('note');
    expect(nota).toHaveTextContent('Esta pantalla solo informa');
    expect(nota).toHaveTextContent(
      'El cierre automático no existe en esta versión. Aunque la condición se cumpla, cada caso sigue necesitando a una persona que lo confirme.',
    );
    expect(within(region).queryAllByRole('button')).toHaveLength(0);
    expect(within(region).queryAllByRole('link')).toHaveLength(0);
    expect(within(region).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(region).queryAllByRole('switch')).toHaveLength(0);
  });

  it('cargando: un solo esqueleto para toda la pantalla hasta que llega la condición', async () => {
    servidor.use(
      http.get('/api/plataforma/condicion-cierre', async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json(NO_CUMPLE);
      }),
    );
    montarPlataforma('/plataforma/medicion');
    const estado = (await screen.findByText('Cargando la medición')).closest(
      '[role="status"]',
    );
    expect(estado).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.queryByRole('heading', { name: 'Tasa de desacuerdo' }),
    ).not.toBeInTheDocument();
    await seccion();
    expect(screen.queryByText('Cargando la medición')).not.toBeInTheDocument();
  });

  it('error en la condición: una alerta para toda la pantalla y «Reintentar» la vuelve a pedir', async () => {
    condicionPlataformaFalla(400);
    montarPlataforma('/plataforma/medicion');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(
      screen.queryByRole('heading', { name: 'Tasa de desacuerdo' }),
    ).not.toBeInTheDocument();
    servidor.resetHandlers();
    usarHandlersPlataforma();
    sesionPlataformaAbierta();
    sembrarCondicionPlataforma(CUMPLE);
    await userEvent
      .setup()
      .click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    const region = await seccion();
    expect(
      within(region).getByText('La condición se cumple con los datos de hoy'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un 401 en la condición termina la sesión sin mostrar el error de conexión', async () => {
    condicionPlataformaFalla(401);
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

  it('un 403 en la condición también termina la sesión', async () => {
    condicionPlataformaFalla(403);
    const { router } = montarPlataforma('/plataforma/medicion');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/plataforma/login'),
    );
    expect(
      screen.queryByText('No se pudo conectar con el servidor.'),
    ).toBeNull();
  });
});
