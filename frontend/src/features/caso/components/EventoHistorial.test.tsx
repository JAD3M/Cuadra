import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventoHistorial, EventoPendiente } from './EventoHistorial';

const INSTANTE = '2026-09-16T15:14:00.000Z';
const FECHA_HORA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

function dibujar(props: Partial<Parameters<typeof EventoHistorial>[0]> = {}) {
  return render(
    <ol>
      <EventoHistorial
        accion="crear"
        usuario={null}
        createdAt={INSTANTE}
        etiquetaCfdi="A-1044"
        {...props}
      />
    </ol>,
  );
}

describe('EventoHistorial', () => {
  it('la propuesta del motor dice qué CFDI propuso, quién y cuándo', () => {
    dibujar();
    expect(
      screen.getByText('El motor propuso el CFDI A-1044'),
    ).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText(FECHA_HORA)).toBeInTheDocument();
  });

  it('sin la etiqueta del CFDI no deja el texto a medias', () => {
    dibujar({ etiquetaCfdi: null });
    expect(screen.getByText('El motor propuso un CFDI')).toBeInTheDocument();
  });

  it('confirmar y rechazar usan la etiqueta y el nombre de quien actuó', () => {
    const { unmount } = dibujar({
      accion: 'confirmar',
      usuario: { nombre: 'Ana' },
    });
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    unmount();
    dibujar({ accion: 'rechazar', usuario: { nombre: 'Luis' } });
    expect(screen.getByText('Rechazada')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
  });

  it('una acción desconocida se muestra tal cual, sin inventar etiqueta', () => {
    dibujar({ accion: 'accion_nueva' });
    expect(screen.getByText('accion_nueva')).toBeInTheDocument();
  });

  it('una acción de Object.prototype no se confunde con una etiqueta', () => {
    dibujar({ accion: 'constructor' });
    expect(screen.getByText('constructor')).toBeInTheDocument();
  });

  it('el punto de color es decorativo', () => {
    const { container } = dibujar();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('EventoPendiente', () => {
  it('es la fila derivada «Esperando decisión» y no es un evento real', () => {
    render(
      <ol>
        <EventoPendiente />
      </ol>,
    );
    expect(screen.getByText('Esperando decisión')).toBeInTheDocument();
    expect(
      screen.getByText('Nadie ha confirmado ni rechazado'),
    ).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByTestId('evento-pendiente')).toBeInTheDocument();
  });
});

describe('EventoHistorial: reapertura (5.7)', () => {
  it('la reapertura se titula «Reabierta» y dice quién y el motivo del servidor', () => {
    dibujar({
      accion: 'reabrir',
      usuario: { nombre: 'Luis Reyes' },
      motivo: 'Confirmé el CFDI equivocado',
    });
    expect(screen.getByText('Reabierta')).toBeInTheDocument();
    expect(
      screen.getByText('Luis Reyes · Confirmé el CFDI equivocado'),
    ).toBeInTheDocument();
  });

  it('sin motivo en el evento no inventa uno', () => {
    dibujar({ accion: 'reabrir', usuario: { nombre: 'Luis Reyes' } });
    expect(screen.getByText('Luis Reyes')).toBeInTheDocument();
  });

  it('un motivo en otra acción no se muestra', () => {
    dibujar({
      accion: 'confirmar',
      usuario: { nombre: 'Ana' },
      motivo: 'no debería verse',
    });
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText(/no debería verse/)).toBeNull();
  });

  it('un comentario se titula «Comentario» y trae autor y texto como detalle', () => {
    dibujar({
      accion: 'comentar',
      usuario: { nombre: 'Jorge Tapia' },
      texto: 'No me convence: parece de otra obra.',
    });
    expect(screen.getByText('Comentario')).toBeInTheDocument();
    expect(
      screen.getByText('Jorge Tapia · No me convence: parece de otra obra.'),
    ).toBeInTheDocument();
  });

  it('un comentario sin texto muestra solo al autor', () => {
    dibujar({ accion: 'comentar', usuario: { nombre: 'Jorge Tapia' } });
    expect(screen.getByText('Comentario')).toBeInTheDocument();
    expect(screen.getByText('Jorge Tapia')).toBeInTheDocument();
  });
});
