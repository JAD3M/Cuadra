import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectorArchivos } from './SelectorArchivos';

const xml = (nombre: string) =>
  new File(['<x/>'], nombre, { type: 'text/xml' });

function montar(
  props: Partial<React.ComponentProps<typeof SelectorArchivos>> = {},
) {
  const onElegir = vi.fn();
  render(
    <SelectorArchivos
      etiqueta="Elegir archivos"
      accept=".xml"
      multiple
      onElegir={onElegir}
      {...props}
    />,
  );
  return { onElegir, entrada: screen.getByLabelText('Elegir archivos') };
}

describe('SelectorArchivos', () => {
  it('la etiqueta devuelve el input real, que cuelga de su <label>', () => {
    const { entrada } = montar();
    expect(entrada).toBeInstanceOf(HTMLInputElement);
    expect(entrada).toHaveAttribute('type', 'file');
    expect(entrada.closest('label')).not.toBeNull();
    expect(entrada.closest('label')).toHaveTextContent('Elegir archivos');
  });

  it('el input es accesible por teclado: oculto a la vista, no al foco', () => {
    const { entrada } = montar();
    expect(entrada).toHaveClass('solo-lectores');
    expect(entrada).not.toHaveAttribute('hidden');
    expect(entrada).not.toHaveAttribute('tabindex', '-1');
    entrada.focus();
    expect(entrada).toHaveFocus();
  });

  it('declara accept y multiple como pista del selector', () => {
    const { entrada } = montar();
    expect(entrada).toHaveAttribute('accept', '.xml');
    expect(entrada).toHaveAttribute('multiple');
  });

  it('un selector de un solo archivo no es múltiple', () => {
    const { entrada } = montar({ multiple: false });
    expect(entrada).not.toHaveAttribute('multiple');
  });

  it('entrega los archivos elegidos, en orden', async () => {
    const { onElegir, entrada } = montar();
    const a = xml('a.xml');
    const b = xml('b.xml');
    await userEvent.setup().upload(entrada, [a, b]);
    expect(onElegir).toHaveBeenCalledTimes(1);
    expect(onElegir).toHaveBeenCalledWith([a, b]);
  });

  it('limpia el valor tras leer: elegir el mismo archivo otra vez vuelve a disparar change', async () => {
    const { onElegir, entrada } = montar();
    const a = xml('a.xml');
    const usuario = userEvent.setup();
    await usuario.upload(entrada, a);
    expect((entrada as HTMLInputElement).value).toBe('');
    await usuario.upload(entrada, a);
    expect(onElegir).toHaveBeenCalledTimes(2);
    expect(onElegir).toHaveBeenLastCalledWith([a]);
  });

  it('deshabilitado: el input lo está y no entrega nada', async () => {
    const { onElegir, entrada } = montar({ deshabilitado: true });
    expect(entrada).toBeDisabled();
    await userEvent.setup().upload(entrada, xml('a.xml'));
    expect(onElegir).not.toHaveBeenCalled();
  });

  it('la variante secundaria y la primaria se distinguen en el DOM', () => {
    const { entrada } = montar({ variante: 'secundario' });
    expect(entrada.closest('label')).toHaveAttribute(
      'data-variante',
      'secundario',
    );
  });
});
