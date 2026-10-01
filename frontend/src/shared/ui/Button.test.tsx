import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('es un button real con tipo button por omisión', () => {
    render(<Button>Confirmar conciliación</Button>);
    const boton = screen.getByRole('button', {
      name: 'Confirmar conciliación',
    });
    expect(boton.tagName).toBe('BUTTON');
    expect(boton).toHaveAttribute('type', 'button');
  });

  it('permite declarar type submit explícitamente', () => {
    render(<Button type="submit">Entrar</Button>);
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('ejecuta el manejador al hacer clic', async () => {
    const alClic = vi.fn();
    render(<Button onClick={alClic}>Guardar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(alClic).toHaveBeenCalledTimes(1);
  });

  it('deshabilitado no ejecuta el manejador ni recibe el foco por teclado', async () => {
    const alClic = vi.fn();
    render(
      <Button disabled onClick={alClic}>
        Rechazar
      </Button>,
    );
    const boton = screen.getByRole('button', { name: 'Rechazar' });
    expect(boton).toBeDisabled();
    await userEvent.click(boton);
    await userEvent.tab();
    expect(alClic).not.toHaveBeenCalled();
    expect(boton).not.toHaveFocus();
  });

  it('se activa con el teclado', async () => {
    const alClic = vi.fn();
    render(<Button onClick={alClic}>Guardar</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(alClic).toHaveBeenCalledTimes(2);
  });

  it.each(['primario', 'secundario', 'peligro', 'fantasma'] as const)(
    'expone la variante %s',
    (variante) => {
      render(<Button variante={variante}>Acción</Button>);
      expect(screen.getByRole('button')).toHaveAttribute(
        'data-variante',
        variante,
      );
    },
  );

  it('la variante por omisión es primario', () => {
    render(<Button>Acción</Button>);
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-variante',
      'primario',
    );
  });

  it('rechaza variantes desconocidas en tiempo de compilación', () => {
    // @ts-expect-error la variante no existe
    render(<Button variante="enorme">Acción</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('conserva className y aria-label en el button', () => {
    render(
      <Button className="extra" aria-label="Página siguiente">
        ›
      </Button>,
    );
    const boton = screen.getByRole('button', { name: 'Página siguiente' });
    expect(boton.className).toContain('extra');
  });
});
