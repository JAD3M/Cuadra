import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { DetalleCarga } from '@/shared/api/contratos';
import { itemCarga } from '@/test/fixturesCargas';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { TablaCargas } from './TablaCargas';

// Fila expandible de una carga rechazada (historia 3.7): el motivo se pide a
// `GET /cargas/:id` al abrir; el listado no lo trae.

const RECHAZADA_1 = itemCarga(1, {
  estado: 'rechazada',
  nombreArchivo: 'estado-sep.pdf',
});
const RECHAZADA_2 = itemCarga(2, {
  estado: 'rechazada',
  nombreArchivo: 'estado-oct.pdf',
});
const PROCESADA = itemCarga(3, { estado: 'procesada' });
const LISTA = [RECHAZADA_1, RECHAZADA_2, PROCESADA];

function detalle(id: string, motivoRechazo: string | null): DetalleCarga {
  return {
    id,
    estado: 'rechazada',
    totalRegistros: 0,
    registrosOk: 0,
    registrosExistentes: 0,
    registrosError: 0,
    resultados: [],
    errorMensaje: null,
    motivoRechazo,
  };
}

function servirMotivos(motivos: Record<string, string | null>) {
  servidor.use(
    http.get('/api/cargas/:id', ({ params }) => {
      const id = String(params.id);
      return id in motivos
        ? HttpResponse.json(detalle(id, motivos[id] ?? null))
        : HttpResponse.json({ message: 'Not Found' }, { status: 404 });
    }),
  );
}

function montar() {
  return render(<TablaCargas cargas={LISTA} />, {
    wrapper: envolturaCargas(clienteDePruebas()),
  });
}

const chevron = (archivo: string) =>
  screen.getByRole('button', {
    name: `Ver motivo del rechazo de ${archivo}`,
  });
const filaDe = (archivo: string) =>
  screen.getByText(archivo).closest('tr') as HTMLElement;

describe('TablaCargas: filas rechazadas expandibles (3.7)', () => {
  it('solo las filas rechazadas traen el botón, cerrado y de 44 px de alto mínimo', () => {
    montar();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    for (const archivo of ['estado-sep.pdf', 'estado-oct.pdf']) {
      expect(chevron(archivo)).toHaveAttribute('aria-expanded', 'false');
    }
    expect(
      within(filaDe('lote-3.xml')).queryByRole('button'),
    ).not.toBeInTheDocument();
  });

  it('sin abrir nada no se pide ningún detalle', () => {
    const espia = espiarSolicitudes();
    montar();
    expect(espia.solicitudes).toEqual([]);
    espia.detener();
  });

  it('el botón abre la fila de detalle con el motivo, a todo el ancho', async () => {
    servirMotivos({ [RECHAZADA_1.id]: 'PDF de otra cuenta' });
    montar();
    await userEvent.click(chevron('estado-sep.pdf'));
    expect(chevron('estado-sep.pdf')).toHaveAttribute('aria-expanded', 'true');
    const motivo = await screen.findByText('PDF de otra cuenta');
    const celda = motivo.closest('td') as HTMLElement;
    expect(celda).toHaveAttribute('colspan', '8');
    expect(within(celda).getByText('Motivo del rechazo')).toBeInTheDocument();
  });

  it('un clic en el botón alterna una sola vez (sin doble disparo con la fila)', async () => {
    servirMotivos({ [RECHAZADA_1.id]: 'uno' });
    montar();
    await userEvent.click(chevron('estado-sep.pdf'));
    expect(chevron('estado-sep.pdf')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(chevron('estado-sep.pdf'));
    expect(chevron('estado-sep.pdf')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Motivo del rechazo')).not.toBeInTheDocument();
  });

  it('un clic en la fila también alterna', async () => {
    servirMotivos({ [RECHAZADA_1.id]: 'uno' });
    montar();
    await userEvent.click(screen.getByText('estado-sep.pdf'));
    expect(chevron('estado-sep.pdf')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByText('estado-sep.pdf'));
    expect(chevron('estado-sep.pdf')).toHaveAttribute('aria-expanded', 'false');
  });

  it('con teclado: Enter abre y Espacio cierra', async () => {
    servirMotivos({ [RECHAZADA_1.id]: 'uno' });
    montar();
    chevron('estado-sep.pdf').focus();
    await userEvent.keyboard('{Enter}');
    expect(chevron('estado-sep.pdf')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    expect(chevron('estado-sep.pdf')).toHaveAttribute('aria-expanded', 'false');
  });

  it('solo una fila abierta a la vez', async () => {
    servirMotivos({
      [RECHAZADA_1.id]: 'primer motivo',
      [RECHAZADA_2.id]: 'segundo motivo',
    });
    montar();
    await userEvent.click(chevron('estado-sep.pdf'));
    await screen.findByText('primer motivo');
    await userEvent.click(chevron('estado-oct.pdf'));
    await screen.findByText('segundo motivo');
    expect(chevron('estado-sep.pdf')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('primer motivo')).not.toBeInTheDocument();
    expect(screen.getAllByText('Motivo del rechazo')).toHaveLength(1);
  });

  it('las demás filas no son clicables', async () => {
    montar();
    const espia = espiarSolicitudes();
    await userEvent.click(screen.getByText('lote-3.xml'));
    expect(screen.queryByText('Motivo del rechazo')).not.toBeInTheDocument();
    expect(espia.solicitudes).toEqual([]);
    espia.detener();
  });

  it('mientras llega dice «Cargando motivo…»', async () => {
    servidor.use(http.get('/api/cargas/:id', () => new Promise(() => {})));
    montar();
    await userEvent.click(chevron('estado-sep.pdf'));
    expect(await screen.findByText('Cargando motivo…')).toBeInTheDocument();
  });

  it('si falla dice «No se pudo cargar el motivo.» como alerta', async () => {
    servidor.use(
      http.get('/api/cargas/:id', () =>
        HttpResponse.json({ message: 'x' }, { status: 500 }),
      ),
    );
    montar();
    await userEvent.click(chevron('estado-sep.pdf'));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo cargar el motivo.');
  });

  it('con motivo nulo dice «Sin motivo registrado.»', async () => {
    servirMotivos({ [RECHAZADA_1.id]: null });
    montar();
    await userEvent.click(chevron('estado-sep.pdf'));
    expect(await screen.findByText('Sin motivo registrado.')).toBeVisible();
  });

  it('el motivo es texto plano: no interpreta marcado', async () => {
    servirMotivos({ [RECHAZADA_1.id]: '<b>hola</b>' });
    montar();
    await userEvent.click(chevron('estado-sep.pdf'));
    await waitFor(() =>
      expect(screen.getByText('<b>hola</b>')).toBeInTheDocument(),
    );
  });
});
