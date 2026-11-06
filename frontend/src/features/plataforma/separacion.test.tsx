import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  sembrarEmpresasPlataforma,
  sesionPlataformaAbierta,
  usarHandlersPlataforma,
} from '@/test/handlersPlataforma';
import { montarPlataforma } from '@/test/montarRutas';
import { servidor } from '@/test/servidor';

interface EmpresaSembrada {
  id: string;
  razonSocial: string;
  rfc: string;
  separacionFunciones: boolean;
}

const AURORA: EmpresaSembrada = {
  id: '00000000-0000-4000-8000-0000000000a1',
  razonSocial: 'Ferretería Aurora S.A. de C.V.',
  rfc: 'FAU210215QK4',
  separacionFunciones: true,
};
const NORTE: EmpresaSembrada = {
  id: '00000000-0000-4000-8000-0000000000a2',
  razonSocial: 'Distribuidora del Norte S.A. de C.V.',
  rfc: 'DNO180904TB7',
  separacionFunciones: true,
};

interface Llamada {
  empresaId: string;
  cuerpo: { activa?: unknown; motivo?: unknown };
}

let llamadas: Llamada[] = [];
let estado: EmpresaSembrada[] = [];

/** Servidor simulado de `PUT .../separacion-funciones`: 409 si ya está así. */
function instalarServidor(empresas: EmpresaSembrada[]) {
  llamadas = [];
  estado = empresas.map((e) => ({ ...e }));
  sembrarEmpresasPlataforma(estado);
  servidor.use(
    http.get('/api/plataforma/empresas', () =>
      HttpResponse.json(estado.map((e) => ({ ...e }))),
    ),
    http.put(
      '/api/plataforma/empresas/:id/separacion-funciones',
      async ({ request, params }) => {
        const cuerpo = (await request.json()) as Llamada['cuerpo'];
        const empresaId = String(params['id']);
        llamadas.push({ empresaId, cuerpo });
        const empresa = estado.find((e) => e.id === empresaId);
        if (!empresa) return respuestaError(404);
        if (typeof cuerpo.activa !== 'boolean') return respuestaError(400);
        if (typeof cuerpo.motivo !== 'string' || cuerpo.motivo.trim() === '') {
          return respuestaError(400);
        }
        if (empresa.separacionFunciones === cuerpo.activa) {
          return respuestaError(409);
        }
        empresa.separacionFunciones = cuerpo.activa;
        return HttpResponse.json({ ...empresa });
      },
    ),
  );
}

function respuestaError(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'texto del servidor' },
    { status },
  );
}

function ponerRespuesta(
  resolver: () =>
    Response | Promise<Response> | ReturnType<typeof HttpResponse.error>,
) {
  servidor.use(
    http.put('/api/plataforma/empresas/:id/separacion-funciones', resolver),
  );
}

beforeEach(() => {
  usarHandlersPlataforma();
  instalarServidor([AURORA, NORTE]);
  sesionPlataformaAbierta();
});

const nombreBoton = (accion: 'Desactivar' | 'Activar', razon: string) =>
  `${accion} la separación de funciones de ${razon}`;

async function abrirPanel(
  accion: 'Desactivar' | 'Activar' = 'Desactivar',
  razon = AURORA.razonSocial,
) {
  montarPlataforma('/plataforma');
  const boton = await screen.findByRole('button', {
    name: nombreBoton(accion, razon),
  });
  const usuario = userEvent.setup();
  await usuario.click(boton);
  return usuario;
}

const avisoSeparacion = () =>
  screen
    .findByText(/^Separación de funciones (desactivada|activada)/)
    .then((titulo) => titulo.closest('[role="status"]') as HTMLElement);

const motivo = () => screen.getByLabelText('Motivo');
const confirmar = () =>
  screen.getByRole('button', {
    name: /^(Desactivar|Activar) separación$|Guardando/,
  });

function filaDe(razon: string) {
  const tabla = screen.getByRole('table', { name: 'Lista de empresas' });
  const celda = within(tabla).getByText(razon);
  return celda.closest('tr') as HTMLElement;
}

describe('plataforma: separación de funciones', () => {
  it('la tabla trae la columna «Separación de funciones» con el chip de cada empresa', async () => {
    instalarServidor([AURORA, { ...NORTE, separacionFunciones: false }]);
    montarPlataforma('/plataforma');
    const tabla = await screen.findByRole('table', {
      name: 'Lista de empresas',
    });
    expect(
      within(tabla).getByRole('columnheader', {
        name: 'Separación de funciones',
      }),
    ).toBeInTheDocument();
    expect(
      within(filaDe(AURORA.razonSocial)).getByText('Activa'),
    ).toBeInTheDocument();
    expect(
      within(filaDe(NORTE.razonSocial)).getByText('Desactivada'),
    ).toBeInTheDocument();
  });

  it('el botón de cada fila nombra la acción y la empresa', async () => {
    instalarServidor([AURORA, { ...NORTE, separacionFunciones: false }]);
    montarPlataforma('/plataforma');
    await screen.findByRole('table', { name: 'Lista de empresas' });
    const aurora = within(filaDe(AURORA.razonSocial));
    const norte = within(filaDe(NORTE.razonSocial));
    expect(
      aurora.getByRole('button', {
        name: `Desactivar la separación de funciones de ${AURORA.razonSocial}`,
      }),
    ).toHaveTextContent('Desactivar separación');
    expect(
      norte.getByRole('button', {
        name: `Activar la separación de funciones de ${NORTE.razonSocial}`,
      }),
    ).toHaveTextContent('Activar separación');
    expect(
      aurora.getByRole('button', {
        name: `Invitar administrador de ${AURORA.razonSocial}`,
      }),
    ).toBeInTheDocument();
  });

  it('abre el panel de desactivar con título, texto, campo «Motivo» y ayuda', async () => {
    await abrirPanel();
    const panel = screen.getByRole('form', {
      name: 'Desactivar separación de funciones',
    });
    expect(
      within(panel).getByRole('heading', {
        name: `Desactivar la separación de funciones de ${AURORA.razonSocial}`,
      }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(
        'Quien suba una carga de esta empresa podrá confirmar sus propias conciliaciones, y todos sus usuarios verán un aviso en la bandeja y en la bitácora. Solo afecta a esta empresa.',
      ),
    ).toBeInTheDocument();
    expect(motivo().tagName).toBe('TEXTAREA');
    expect(motivo()).toBeRequired();
    expect(motivo()).toHaveAttribute('maxlength', '500');
    expect(motivo()).toHaveValue('');
    expect(motivo()).toHaveFocus();
    expect(motivo()).toHaveAccessibleDescription(
      'Obligatorio, hasta 500 caracteres. Queda en la bitácora de la plataforma y en la de la empresa.',
    );
    expect(
      within(panel).getByRole('button', { name: 'Desactivar separación' }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: 'Cancelar' }),
    ).toBeInTheDocument();
  });

  it('abre el panel de activar con su título y su texto', async () => {
    instalarServidor([{ ...AURORA, separacionFunciones: false }, NORTE]);
    await abrirPanel('Activar');
    const panel = screen.getByRole('form', {
      name: 'Activar separación de funciones',
    });
    expect(
      within(panel).getByRole('heading', {
        name: `Volver a activar la separación de funciones de ${AURORA.razonSocial}`,
      }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(
        'La empresa volverá a impedir que quien sube una carga confirme sus propias conciliaciones, y el aviso de la bandeja y de la bitácora desaparece.',
      ),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: 'Activar separación' }),
    ).toBeInTheDocument();
  });

  it('desactiva con el motivo recortado, avisa y refresca solo el chip de esa empresa', async () => {
    const usuario = await abrirPanel();
    await usuario.type(motivo(), '  Equipo de dos personas  ');
    await usuario.click(confirmar());
    const aviso = await avisoSeparacion();
    expect(aviso).toHaveTextContent('Separación de funciones desactivada.');
    expect(aviso).toHaveTextContent(
      `${AURORA.razonSocial}. Quedó en la bitácora de la plataforma y en la de la empresa, con tu usuario, la fecha y el motivo.`,
    );
    expect(llamadas).toEqual([
      {
        empresaId: AURORA.id,
        cuerpo: { activa: false, motivo: 'Equipo de dos personas' },
      },
    ]);
    expect(
      screen.queryByRole('form', {
        name: 'Desactivar separación de funciones',
      }),
    ).toBeNull();
    await waitFor(() =>
      expect(
        within(filaDe(AURORA.razonSocial)).getByText('Desactivada'),
      ).toBeInTheDocument(),
    );
    expect(
      within(filaDe(NORTE.razonSocial)).getByText('Activa'),
    ).toBeInTheDocument();
    expect(
      within(filaDe(AURORA.razonSocial)).getByRole('button', {
        name: nombreBoton('Activar', AURORA.razonSocial),
      }),
    ).toBeInTheDocument();
  });

  it('vuelve a activar con `activa: true`, el motivo, el aviso y el chip «Activa»', async () => {
    instalarServidor([AURORA, { ...NORTE, separacionFunciones: false }]);
    const usuario = await abrirPanel('Activar', NORTE.razonSocial);
    await usuario.type(motivo(), 'Ya hay más personal');
    await usuario.click(confirmar());
    const aviso = await avisoSeparacion();
    expect(aviso).toHaveTextContent(
      'Separación de funciones activada de nuevo.',
    );
    expect(aviso).toHaveTextContent(
      `${NORTE.razonSocial}. Quedó en la bitácora de la plataforma y en la de la empresa, con tu usuario, la fecha y el motivo.`,
    );
    expect(llamadas).toEqual([
      {
        empresaId: NORTE.id,
        cuerpo: { activa: true, motivo: 'Ya hay más personal' },
      },
    ]);
    await waitFor(() =>
      expect(
        within(filaDe(NORTE.razonSocial)).getByText('Activa'),
      ).toBeInTheDocument(),
    );
    expect(
      within(filaDe(AURORA.razonSocial)).getByText('Activa'),
    ).toBeInTheDocument();
  });

  it('un motivo en blanco marca el campo, devuelve el foco y no llama a la API', async () => {
    const usuario = await abrirPanel();
    await usuario.type(motivo(), '   ');
    await usuario.click(confirmar());
    expect(
      await screen.findByText('Escribe el motivo del cambio.'),
    ).toBeInTheDocument();
    expect(motivo()).toHaveAttribute('aria-invalid', 'true');
    expect(motivo()).toHaveAccessibleDescription(
      /Escribe el motivo del cambio\./,
    );
    expect(motivo()).toHaveFocus();
    expect(llamadas).toHaveLength(0);
    expect(
      screen.queryByText(/^Separación de funciones (desactivada|activada)/),
    ).toBeNull();
  });

  it('un 400 del servidor deja «Escribe el motivo del cambio.» bajo el campo y conserva el panel', async () => {
    ponerRespuesta(() => respuestaError(400));
    const usuario = await abrirPanel();
    await usuario.type(motivo(), 'Un motivo');
    await usuario.click(confirmar());
    expect(
      await screen.findByText('Escribe el motivo del cambio.'),
    ).toBeInTheDocument();
    expect(motivo()).toHaveAttribute('aria-invalid', 'true');
    expect(motivo()).toHaveValue('Un motivo');
    expect(
      screen.queryByText(/^Separación de funciones (desactivada|activada)/),
    ).toBeNull();
  });

  it('con 409 avisa que ya estaba así, cierra el panel y vuelve a pedir la lista', async () => {
    const usuario = await abrirPanel();
    // Otra persona la desactivó mientras tanto: el servidor ya la tiene así.
    estado[0]!.separacionFunciones = false;
    await usuario.type(motivo(), 'Un motivo');
    await usuario.click(confirmar());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'La separación de funciones ya estaba en ese estado.',
    );
    expect(alerta).toHaveTextContent('No se cambió nada.');
    expect(alerta).not.toHaveTextContent('texto del servidor');
    expect(
      screen.queryByRole('form', {
        name: 'Desactivar separación de funciones',
      }),
    ).toBeNull();
    expect(
      screen.queryByText(/^Separación de funciones (desactivada|activada)/),
    ).toBeNull();
    await waitFor(() =>
      expect(
        within(filaDe(AURORA.razonSocial)).getByText('Desactivada'),
      ).toBeInTheDocument(),
    );
  });

  it('con fallo de red usa la alerta de conexión y deja el panel con el motivo', async () => {
    ponerRespuesta(() => HttpResponse.error());
    const usuario = await abrirPanel();
    await usuario.type(motivo(), 'Un motivo');
    await usuario.click(confirmar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
    expect(motivo()).toHaveValue('Un motivo');
    expect(
      screen.queryByText(/^Separación de funciones (desactivada|activada)/),
    ).toBeNull();
    expect(
      within(filaDe(AURORA.razonSocial)).getByText('Activa'),
    ).toBeInTheDocument();
  });

  it('con 404 muestra una alerta general y vuelve a pedir la lista', async () => {
    const usuario = await abrirPanel();
    estado.splice(0, 1);
    await usuario.type(motivo(), 'Un motivo');
    await usuario.click(confirmar());
    expect(await screen.findByRole('alert')).not.toHaveTextContent(
      'texto del servidor',
    );
    await waitFor(() =>
      expect(screen.queryByText(AURORA.razonSocial)).toBeNull(),
    );
    expect(
      screen.queryByText(/^Separación de funciones (desactivada|activada)/),
    ).toBeNull();
  });

  it('cancelar cierra el panel sin llamar a la API', async () => {
    const usuario = await abrirPanel();
    await usuario.type(motivo(), 'Un motivo');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('form', {
        name: 'Desactivar separación de funciones',
      }),
    ).toBeNull();
    expect(llamadas).toHaveLength(0);
  });

  it('abrir el panel de otra empresa reemplaza al anterior con el campo vacío', async () => {
    const usuario = await abrirPanel();
    await usuario.type(motivo(), 'Un motivo');
    await usuario.click(
      screen.getByRole('button', {
        name: nombreBoton('Desactivar', NORTE.razonSocial),
      }),
    );
    expect(
      screen.getAllByRole('form', {
        name: 'Desactivar separación de funciones',
      }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('heading', {
        name: `Desactivar la separación de funciones de ${NORTE.razonSocial}`,
      }),
    ).toBeInTheDocument();
    expect(motivo()).toHaveValue('');
  });

  it('un 401 termina la sesión de plataforma', async () => {
    ponerRespuesta(() => respuestaError(401));
    const usuario = await abrirPanel();
    await usuario.type(motivo(), 'Un motivo');
    await usuario.click(confirmar());
    expect(
      await screen.findByText(
        'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
      ),
    ).toBeInTheDocument();
  });
});
