import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { eventoDeBitacora, USUARIOS_BITACORA } from '@/test/fixturesBitacora';
import { CONTEXTO_SESION, capacidadesDeRoles } from '@/test/fixtures';
import { almacenes } from '@/test/handlers';
import { elegirEmpresaMock, hayEmpresaElegida } from '@/test/sesionMock';
import { entrarALaApp, montarApp } from '@/test/montarApp';
import { servidor } from '@/test/servidor';
import type { EventoBitacora } from '@/test/fixturesTolerancia';

// Historia 2.7: los cuatro roles ven la administración en la bitácora.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

const bitacora = almacenes.bitacora;
const ANA = USUARIOS_BITACORA[0]!;
const JORGE = USUARIOS_BITACORA[2]!;
const EMPRESA = '0191f2c0-51c0-7a3f-8e44-a3f4b27d9e10';
const CORREO = 'luis.reyes@ferreteria.mx';

const admin = (
  n: number,
  accion: EventoBitacora['accion'],
  datos: unknown,
): EventoBitacora =>
  eventoDeBitacora(n, {
    entidad: 'companies',
    entidadId: EMPRESA,
    accion,
    usuario: ANA,
    datos,
    createdAt: `2026-09-18T22:0${n}:00.000Z`,
  });

const EVENTOS: readonly EventoBitacora[] = [
  admin(1, 'invitar', {
    invitacionId: EMPRESA,
    email: CORREO,
    roles: ['contador', 'revisor'],
  }),
  admin(2, 'reenviar_invitacion', {
    invitacionId: EMPRESA,
    anteriorId: EMPRESA,
    email: CORREO,
    roles: ['contador'],
  }),
  admin(3, 'cancelar_invitacion', { invitacionId: EMPRESA, email: CORREO }),
  admin(4, 'cambiar_rol', {
    usuarioId: EMPRESA,
    email: CORREO,
    antes: ['contador'],
    despues: ['contador', 'revisor'],
  }),
  admin(5, 'quitar_rol', {
    usuarioId: EMPRESA,
    email: CORREO,
    roles: ['auditor'],
  }),
  eventoDeBitacora(6, {
    entidad: 'companies',
    entidadId: EMPRESA,
    accion: 'acceso_denegado',
    usuario: JORGE,
    createdAt: '2026-09-18T21:47:00.000Z',
    datos: {
      metodo: 'PUT',
      ruta: '/empresa/tolerancia',
      motivo: 'rol_insuficiente',
      rolesRequeridos: ['admin'],
      rolesDelUsuario: ['revisor'],
      permiso: 'tolerancia.editar',
    },
  }),
];

beforeEach(() => bitacora.establecer(EVENTOS));
afterEach(() => bitacora.establecer([]));

/** La sesión entrega estos roles y las capacidades que derivaría el servidor. */
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

const filas = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);
const fila = (accion: string) =>
  filas().find((f) => f.getAttribute('data-accion') === accion)!;

async function abrir(roles: string[]) {
  conRoles(roles);
  const montada = montarApp('/bitacora');
  await entrarALaApp();
  await waitFor(() => expect(filas()).toHaveLength(EVENTOS.length));
  return montada;
}

const consultas = () =>
  bitacora
    .peticiones()
    .filter((p) => p.ruta === '/api/bitacora')
    .map((p) => p.consulta);

const ETIQUETAS: Record<string, string> = {
  invitar: 'Invitación enviada',
  reenviar_invitacion: 'Invitación reenviada',
  cancelar_invitacion: 'Invitación cancelada',
  cambiar_rol: 'Rol cambiado',
  quitar_rol: 'Rol quitado',
};

const DETALLES: Record<string, string> = {
  invitar: `correo: ${CORREO} · roles: Contador y Revisor`,
  reenviar_invitacion: `correo: ${CORREO} · enlace anterior invalidado · roles: Contador`,
  cancelar_invitacion: `correo: ${CORREO}`,
  cambiar_rol: `${CORREO} · roles: Contador → Contador y Revisor`,
  quitar_rol: `${CORREO} · roles quitados: Auditor`,
};

describe.each([['admin'], ['contador'], ['revisor'], ['auditor']])(
  'bitácora de administración con el rol %s',
  (rol) => {
    it('abre la bitácora y ve las acciones de administración en español con su detalle', async () => {
      await abrir([rol]);
      expect(
        screen.getByRole('link', { name: /^Bitácora/ }),
      ).toBeInTheDocument();
      for (const [accion, etiqueta] of Object.entries(ETIQUETAS)) {
        const f = fila(accion);
        const chip = within(f).getByText(etiqueta);
        expect(chip).toHaveAttribute('data-tono', 'neutral');
        expect(within(f).getByText('Ana Mendoza')).toBeInTheDocument();
        expect(within(f).getByText('companies')).toBeInTheDocument();
        expect(within(f).getByText(EMPRESA)).toBeInTheDocument();
        expect(within(f).getByText(DETALLES[accion]!)).toBeInTheDocument();
        expect(within(f).queryByText(accion)).toBeNull();
      }
    });

    it('ve el acceso denegado con rol, permiso y cuándo, con el estilo de peligro', async () => {
      await abrir([rol]);
      const f = fila('acceso_denegado');
      expect(f.className).toMatch(/filaDenegada/);
      expect(within(f).getByText('acceso_denegado')).toHaveAttribute(
        'data-tono',
        'denegado',
      );
      expect(
        within(f).getByText(
          'PUT /empresa/tolerancia · rol insuficiente: requiere admin, tiene revisor · permiso: tolerancia.editar',
        ),
      ).toBeInTheDocument();
      expect(within(f).getByText('Jorge Tapia')).toBeInTheDocument();
      expect(within(f).getByRole('time')).toHaveAttribute(
        'datetime',
        '2026-09-18T21:47:00.000Z',
      );
    });

    it('el filtro de acción ofrece los textos en español y filtra por el valor de la API', async () => {
      const { router } = await abrir([rol]);
      const filtro = screen.getByLabelText('Acción');
      for (const [valor, etiqueta] of Object.entries(ETIQUETAS)) {
        expect(
          within(filtro).getByRole('option', { name: etiqueta }),
        ).toHaveValue(valor);
      }
      await userEvent.setup().selectOptions(filtro, 'Rol cambiado');
      await waitFor(() =>
        expect(router.state.location.search).toBe('?accion=cambiar_rol'),
      );
      await waitFor(() => expect(filas()).toHaveLength(1));
      expect(consultas().at(-1)).toEqual({
        accion: 'cambiar_rol',
        pagina: '1',
        limite: '50',
      });
      expect(fila('cambiar_rol')).toHaveTextContent(DETALLES.cambiar_rol!);
    });

    it('no ofrece editar ni borrar entradas y solo lee', async () => {
      await abrir([rol]);
      const tabla = screen.getByRole('table');
      expect(within(tabla).queryByRole('button')).toBeNull();
      expect(within(tabla).queryByRole('link')).toBeNull();
      const principal = screen.getByRole('main');
      expect(
        within(principal).queryByRole('button', {
          name: /edit|borr|elimin|quitar|modific/i,
        }),
      ).toBeNull();
      expect(
        within(principal).queryByRole('link', {
          name: /edit|borr|elimin|modific/i,
        }),
      ).toBeNull();
      expect(bitacora.peticiones().filter((p) => p.metodo !== 'GET')).toEqual(
        [],
      );
    });
  },
);

describe('bitácora de administración: filtros y vacío', () => {
  it.each(Object.entries(ETIQUETAS))(
    'elegir «%s»... %s manda su valor de API',
    async (valor, etiqueta) => {
      await abrir(['admin']);
      await userEvent
        .setup()
        .selectOptions(screen.getByLabelText('Acción'), etiqueta);
      await waitFor(() => expect(filas()).toHaveLength(1));
      expect(consultas().at(-1)?.accion).toBe(valor);
      expect(filas()[0]).toHaveAttribute('data-accion', valor);
    },
  );

  it('las demás acciones se ofrecen con el valor de la API', async () => {
    await abrir(['auditor']);
    const filtro = screen.getByLabelText('Acción');
    const textos = within(filtro)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(textos).toEqual([
      'Todas',
      'crear',
      'actualizar',
      'eliminar',
      'cargar',
      'confirmar',
      'rechazar',
      'acceso_denegado',
      'Invitación enviada',
      'Invitación reenviada',
      'Invitación cancelada',
      'Rol cambiado',
      'Rol quitado',
    ]);
  });

  it('una acción de administración sin resultados lo dice y ofrece restablecer', async () => {
    bitacora.establecer([EVENTOS[5]!]);
    conRoles(['revisor']);
    montarApp('/bitacora?accion=quitar_rol');
    await entrarALaApp();
    expect(
      await screen.findByText('No hay eventos con estos filtros.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Acción')).toHaveValue('quitar_rol');
    expect(
      screen.getByRole('button', { name: 'Restablecer filtros' }),
    ).toBeInTheDocument();
  });

  it('sin eventos muestra el texto de la maqueta con las invitaciones y los roles', async () => {
    bitacora.establecer([]);
    conRoles(['auditor']);
    montarApp('/bitacora');
    await entrarALaApp();
    expect(
      await screen.findByText('Aún no hay eventos en la bitácora.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Aquí aparecerá cada confirmación, rechazo, cambio de tolerancia, invitación, cambio de rol y acceso denegado de la empresa.',
      ),
    ).toBeInTheDocument();
  });
});
