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
