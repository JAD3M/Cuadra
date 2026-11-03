import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bancosPlataformaFalla,
  levantamientosRecibidos,
  levantarVistaPreviaFalla,
  levantarVistaPreviaRedDeFallo,
  sembrarBancosPlataforma,
  sesionPlataformaAbierta,
  usarHandlersPlataforma,
  type BancoSimulado,
} from '@/test/handlersPlataforma';
import { montarPlataforma } from '@/test/montarRutas';

const LISTO: BancoSimulado = {
  banco: 'bbva',
  aceptadas: 5,
  minimoAceptadas: 5,
  levantada: false,
  levantadaEn: null,
};

beforeEach(() => {
  usarHandlersPlataforma();
  sesionPlataformaAbierta();
  sembrarBancosPlataforma([LISTO]);
});

const botonLevantar = () =>
  screen.findByRole('button', { name: 'Levantar la vista previa de BBVA' });

async function abrirPanel() {
  montarPlataforma('/plataforma');
  const usuario = userEvent.setup();
  await usuario.click(await botonLevantar());
  return usuario;
}

const confirmar = () =>
  within(screen.getByRole('form', { name: 'Levantar vista previa' })).getByRole(
    'button',
    { name: 'Levantar vista previa' },
  );

describe('plataforma: bancos', () => {
  it('muestra la sección con su título, su texto y la tabla de bancos', async () => {
    montarPlataforma('/plataforma');
    expect(
      await screen.findByRole('heading', { name: 'Bancos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Aquí decides cuándo un banco deja de pedir vista previa. Se cuentan las cargas aceptadas de todas las empresas.',
      ),
    ).toBeInTheDocument();
    const tabla = await screen.findByRole('table', { name: 'Lista de bancos' });
    const encabezados = within(tabla)
      .getAllByRole('columnheader')
      .map((c) => c.textContent);
    expect(encabezados).toEqual([
      'Banco',
      'Cargas aceptadas',
      'Estado',
      'Acciones',
    ]);
    const fila = within(tabla).getByRole('row', { name: /BBVA/ });
    expect(within(fila).getByRole('rowheader')).toHaveTextContent('BBVA');
    expect(within(fila).getByText('5')).toBeInTheDocument();
    expect(within(fila).getByText('Vista previa obligatoria')).toBeVisible();
  });

  it('con las cargas del mínimo que manda el servidor, el botón está habilitado', async () => {
    montarPlataforma('/plataforma');
    expect(await botonLevantar()).toBeEnabled();
  });

  it('con menos del mínimo, el botón va deshabilitado y dice cuántas faltan (plural)', async () => {
    sembrarBancosPlataforma([{ ...LISTO, aceptadas: 3 }]);
    montarPlataforma('/plataforma');
    expect(await botonLevantar()).toBeDisabled();
    expect(screen.getByText('Faltan 2 cargas aceptadas')).toBeInTheDocument();
  });

  it('con una sola carga por completar dice «Faltan 1 carga aceptada»', async () => {
    sembrarBancosPlataforma([{ ...LISTO, aceptadas: 4 }]);
    montarPlataforma('/plataforma');
    await botonLevantar();
    expect(screen.getByText('Faltan 1 carga aceptada')).toBeInTheDocument();
  });

  it('el mínimo sale de la respuesta, no de una constante del frontend', async () => {
    sembrarBancosPlataforma([{ ...LISTO, aceptadas: 6, minimoAceptadas: 8 }]);
    montarPlataforma('/plataforma');
    expect(await botonLevantar()).toBeDisabled();
    expect(screen.getByText('Faltan 2 cargas aceptadas')).toBeInTheDocument();
  });

  it('un banco levantado muestra la fecha, «Sin acciones» y ningún botón', async () => {
    sembrarBancosPlataforma([
      {
        ...LISTO,
        levantada: true,
        levantadaEn: '2026-11-03T18:30:00.000Z',
      },
    ]);
    montarPlataforma('/plataforma');
    const tabla = await screen.findByRole('table', { name: 'Lista de bancos' });
    expect(
      within(tabla).getByText('Levantada el 3 nov 2026'),
    ).toBeInTheDocument();
    expect(within(tabla).getByText('Sin acciones')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Levantar la vista previa/ }),
    ).toBeNull();
  });

  it('mientras carga hay un esqueleto ocupado y no hay tabla', async () => {
    montarPlataforma('/plataforma');
    const seccion = await screen.findByRole('region', {
      name: 'Lista de bancos',
    });
    expect(seccion).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('table', { name: 'Lista de bancos' })).toBeNull();
    await screen.findByRole('table', { name: 'Lista de bancos' });
  });

  // Un 5xx se reintenta dos veces con espera: la prueba lo espera completo.
  it(
    'si la lista falla muestra el aviso de conexión',
    { timeout: 15000 },
    async () => {
      bancosPlataformaFalla(500);
      montarPlataforma('/plataforma');
      const seccion = await screen.findByRole('region', {
        name: 'Lista de bancos',
      });
      await waitFor(
        () =>
          expect(within(seccion).getByRole('alert')).toHaveTextContent(
            'No se pudo conectar con el servidor.',
          ),
        { timeout: 10000 },
      );
      expect(within(seccion).getByRole('alert')).toHaveTextContent(
        'Inténtalo de nuevo.',
      );
      expect(seccion).toHaveAttribute('aria-busy', 'false');
    },
  );

  it('un 401 al pedir los bancos termina la sesión', async () => {
    bancosPlataformaFalla(401);
    montarPlataforma('/plataforma');
    expect(
      await screen.findByText(
        'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
      ),
    ).toBeInTheDocument();
  });
});

describe('plataforma: levantar la vista previa', () => {
  it('abre el panel de confirmación y Cancelar lo cierra sin llamar a la API', async () => {
    const usuario = await abrirPanel();
    const panel = screen.getByRole('form', { name: 'Levantar vista previa' });
    expect(
      within(panel).getByRole('heading', {
        name: 'Levantar la vista previa de BBVA',
      }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(
        'Desde ahora, los PDF de BBVA de todas las empresas pasarán directo a conciliación, sin vista previa. El cuadre de saldos sigue aplicando. Esto no se puede deshacer desde aquí.',
      ),
    ).toBeInTheDocument();
    await usuario.click(
      within(panel).getByRole('button', { name: 'Cancelar' }),
    );
    expect(
      screen.queryByRole('form', { name: 'Levantar vista previa' }),
    ).toBeNull();
    expect(levantamientosRecibidos).toHaveLength(0);
  });

  it('confirmar llama a la API, avisa y refresca la lista', async () => {
    const usuario = await abrirPanel();
    await usuario.click(confirmar());
    const titulo = await screen.findByText('Vista previa de BBVA levantada.');
    expect(titulo.closest('[role="status"]')).toHaveTextContent(
      'Quedó registrada con tu usuario y la fecha.',
    );
    expect(levantamientosRecibidos).toEqual(['bbva']);
    expect(
      screen.queryByRole('form', { name: 'Levantar vista previa' }),
    ).toBeNull();
    expect(
      await screen.findByText(/^Levantada el \d{1,2} \w+ 2026$/),
    ).toBeInTheDocument();
    expect(screen.getByText('Sin acciones')).toBeInTheDocument();
  });

  it('un 409 dice que ya estaba levantado y no cambia nada', async () => {
    levantarVistaPreviaFalla(409);
    const usuario = await abrirPanel();
    await usuario.click(confirmar());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Ese banco ya estaba levantado.');
    expect(alerta).toHaveTextContent('No se cambió nada.');
  });

  it('un 422 muestra el título y el mensaje del servidor', async () => {
    levantarVistaPreviaFalla(
      422,
      'El banco bbva tiene 3 cargas aceptadas; se necesitan al menos 5 para levantar la vista previa',
    );
    const usuario = await abrirPanel();
    await usuario.click(confirmar());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Todavía no hay evidencia suficiente.');
    expect(alerta).toHaveTextContent(
      'El banco bbva tiene 3 cargas aceptadas; se necesitan al menos 5 para levantar la vista previa',
    );
  });

  it('un fallo de red avisa que no se pudo conectar', async () => {
    levantarVistaPreviaRedDeFallo();
    const usuario = await abrirPanel();
    await usuario.click(confirmar());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent('Inténtalo de nuevo.');
  });

  it('un 500 también cae en el aviso de conexión', async () => {
    levantarVistaPreviaFalla(500);
    const usuario = await abrirPanel();
    await usuario.click(confirmar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });

  it('un 403 al levantar termina la sesión', async () => {
    levantarVistaPreviaFalla(403);
    const usuario = await abrirPanel();
    await usuario.click(confirmar());
    await waitFor(() =>
      expect(
        screen.getByText(
          'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
        ),
      ).toBeInTheDocument(),
    );
  });
});
