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
import { CONTEXTO_SESION, capacidadesDeRoles } from '@/test/fixtures';
import { eventoDeBitacora } from '@/test/fixturesBitacora';
import { almacenes } from '@/test/handlers';
import { entrarALaApp, montarApp } from '@/test/montarApp';
import { elegirEmpresaMock, hayEmpresaElegida } from '@/test/sesionMock';
import { servidor } from '@/test/servidor';

// Historia 5.5 (UX-DR9): con la separación desactivada, cualquier usuario de la
// empresa ve el aviso en la bandeja y en la bitácora; con ella activa, no.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

const bitacora = almacenes.bitacora;
const EMPRESA = '0191f2c0-51c0-7a3f-8e44-a3f4b27d9e10';
const TITULO = 'Esta empresa opera sin separación de funciones.';
const MOTIVO = 'Despacho de una sola persona';

/** El servidor responde este contexto: roles y estado de la separación. */
function conContexto(roles: string[], separacionFunciones: boolean) {
  const contexto = () => ({
    ...CONTEXTO_SESION,
    empresa: { ...CONTEXTO_SESION.empresa, separacionFunciones },
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

const ROLES = [['admin'], ['contador'], ['revisor'], ['auditor']];

describe.each(ROLES)('aviso sin separación con el rol %s', (rol) => {
  it('lo ve en la bandeja, antes de los indicadores', async () => {
    conContexto([rol!], false);
    montarApp('/bandeja');
    await entrarALaApp();
    const titulo = await screen.findByText(TITULO);
    expect(titulo.closest('[role="status"]')).not.toBeNull();
    await screen.findByRole('table');
    expect(screen.getAllByText(TITULO)).toHaveLength(1);
  });

  it('lo ve en la bitácora', async () => {
    conContexto([rol!], false);
    montarApp('/bitacora');
    await entrarALaApp();
    expect(await screen.findByText(TITULO)).toBeInTheDocument();
  });

  it('no lo ve con la separación activa (bandeja y bitácora)', async () => {
    conContexto([rol!], true);
    montarApp('/bandeja');
    await entrarALaApp();
    await screen.findByRole('table');
    expect(screen.queryByText(TITULO)).toBeNull();
  });
});

describe('aviso sin separación: contexto y bitácora', () => {
  beforeEach(() => bitacora.establecer([]));
  afterEach(() => bitacora.establecer([]));

  it('al abrir la bandeja o la bitácora relee el contexto: el aviso aparece y desaparece sin recargar', async () => {
    conContexto(['contador'], true);
    montarApp('/bitacora');
    await entrarALaApp();
    await screen.findByText('Aún no hay eventos en la bitácora.');
    expect(screen.queryByText(TITULO)).toBeNull();

    // El dueño la desactiva mientras esta persona tiene la sesión abierta.
    conContexto(['contador'], false);
    await userEvent.click(screen.getByRole('link', { name: /^Bandeja/ }));
    expect(await screen.findByText(TITULO)).toBeInTheDocument();

    // Y la vuelve a activar: al abrir la bitácora el aviso se va.
    conContexto(['contador'], true);
    await userEvent.click(screen.getByRole('link', { name: /^Bitácora/ }));
    await screen.findByText('Aún no hay eventos en la bitácora.');
    await waitFor(() => expect(screen.queryByText(TITULO)).toBeNull());
  });

  it('con la separación activa la bitácora no lo muestra', async () => {
    conContexto(['auditor'], true);
    montarApp('/bitacora');
    await entrarALaApp();
    await screen.findByText('Aún no hay eventos en la bitácora.');
    expect(screen.queryByText(TITULO)).toBeNull();
  });

  it('la fila de la acción nueva muestra su etiqueta, tono neutro y detalle en las dos direcciones', async () => {
    const cambio = (n: number, antes: boolean, datos: object = {}) =>
      eventoDeBitacora(n, {
        entidad: 'companies',
        entidadId: EMPRESA,
        accion: 'desactivar_separacion',
        usuario: null,
        datos: {
          plataformaUsuarioId: EMPRESA,
          motivo: MOTIVO,
          antes,
          despues: !antes,
          ...datos,
        },
        createdAt: `2026-09-18T22:0${n}:00.000Z`,
      });
    bitacora.establecer([
      cambio(1, true),
      cambio(2, false),
      cambio(3, true, { motivo: undefined }),
    ]);
    conContexto(['auditor'], false);
    montarApp('/bitacora');
    await entrarALaApp();
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).getAllByRole('row'),
      ).toHaveLength(4),
    );
    const filas = within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1);
    for (const f of filas) {
      expect(f).toHaveAttribute('data-accion', 'desactivar_separacion');
      expect(
        within(f).getByText('Separación de funciones cambiada'),
      ).toHaveAttribute('data-tono', 'neutral');
    }
    const textos = filas.map((f) => f.textContent ?? '');
    const detalle = (a: string, b: string) =>
      `separación de funciones: ${a} → ${b} · por el dueño de la plataforma · motivo: ${MOTIVO}`;
    expect(
      textos.some((t) => t.includes(detalle('activa', 'desactivada'))),
    ).toBe(true);
    expect(
      textos.some((t) => t.includes(detalle('desactivada', 'activa'))),
    ).toBe(true);
    expect(
      textos.filter((t) => !t.includes('separación de funciones:')),
    ).toHaveLength(1);
  });

  it('el filtro elige la acción y manda accion=desactivar_separacion', async () => {
    bitacora.establecer([
      eventoDeBitacora(1, {
        entidad: 'companies',
        entidadId: EMPRESA,
        accion: 'desactivar_separacion',
        usuario: null,
        datos: {
          plataformaUsuarioId: EMPRESA,
          motivo: MOTIVO,
          antes: true,
          despues: false,
        },
      }),
    ]);
    conContexto(['admin'], true);
    montarApp('/bitacora');
    await entrarALaApp();
    const filtro = await screen.findByLabelText('Acción');
    await userEvent
      .setup()
      .selectOptions(filtro, 'Separación de funciones cambiada');
    await waitFor(() =>
      expect(
        bitacora
          .peticiones()
          .filter((p) => p.ruta === '/api/bitacora')
          .at(-1)?.consulta.accion,
      ).toBe('desactivar_separacion'),
    );
  });
});
