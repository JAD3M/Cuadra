import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Historial, type HistorialProps } from './Historial';

const EVENTOS = [
  {
    id: 'e1',
    accion: 'crear',
    createdAt: '2026-09-16T15:14:00.000Z',
    usuario: null,
  },
  {
    id: 'e2',
    accion: 'confirmar',
    createdAt: '2026-10-05T18:00:00.000Z',
    usuario: { nombre: 'Ana' },
  },
];

function dibujar(props: Partial<HistorialProps> = {}) {
  return render(
    <Historial
      eventos={EVENTOS}
      etiquetaCfdi="A-1044"
      pendiente={false}
      {...props}
    />,
  );
}

describe('Historial', () => {
  it('tiene el título «Historial» como encabezado', () => {
    dibujar();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Historial' }),
    ).toBeInTheDocument();
  });

  it('lista los eventos en el orden recibido', () => {
    dibujar();
    const lista = screen.getByRole('list');
    const items = within(lista).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('El motor propuso el CFDI A-1044');
    expect(items[0]).toHaveTextContent('Sistema');
    expect(items[1]).toHaveTextContent('Confirmada');
    expect(items[1]).toHaveTextContent('Ana');
  });

  it('nunca muestra datos, correo, IP ni agente de usuario', () => {
    const conSecretos = EVENTOS.map((e) => ({
      ...e,
      datos: { ip: '203.0.113.7', ids: ['uuid-oculto'] },
      email: 'ana@empresa.mx',
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      usuario:
        e.usuario === null ? null : { ...e.usuario, email: 'ana@empresa.mx' },
    }));
    const { container } = dibujar({ eventos: conSecretos });
    expect(container).not.toHaveTextContent('203.0.113.7');
    expect(container).not.toHaveTextContent('uuid-oculto');
    expect(container).not.toHaveTextContent('ana@empresa.mx');
    expect(container).not.toHaveTextContent('Mozilla');
  });

  it('sin eventos dice que aún no hay', () => {
    dibujar({ eventos: [] });
    expect(
      screen.getByText('Aún no hay eventos en el historial.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('la fila «Esperando decisión» solo sale cuando se pide y va al final', () => {
    const { unmount } = dibujar();
    expect(screen.queryByTestId('evento-pendiente')).toBeNull();
    unmount();
    dibujar({ pendiente: true });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[2]).toHaveAttribute('data-testid', 'evento-pendiente');
    expect(screen.getByText('Esperando decisión')).toBeInTheDocument();
  });

  it('con la fila pendiente no dice que está vacío', () => {
    dibujar({ eventos: [], pendiente: true });
    expect(screen.queryByText(/Aún no hay eventos/)).toBeNull();
    expect(screen.getByText('Esperando decisión')).toBeInTheDocument();
  });

  it('el error es propio, con «Reintentar», y no esconde el título', async () => {
    const reintentar = vi.fn();
    dibujar({ eventos: [], fallo: true, onReintentar: reintentar });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Historial' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
    expect(screen.queryByText(/Aún no hay eventos/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reintentar).toHaveBeenCalledTimes(1);
  });

  it('mientras carga marca la región como ocupada y no afirma que está vacío', () => {
    const { container } = dibujar({ eventos: [], cargando: true });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(/Aún no hay eventos/)).toBeNull();
  });
});
