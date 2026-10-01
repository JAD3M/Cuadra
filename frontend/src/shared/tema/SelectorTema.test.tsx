import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OPCIONES_TEMA } from './opcionesTema';
import { SelectorTema, type OpcionSelector } from './SelectorTema';
import type { Preferencia } from './tipos';

function Controlado({
  inicial = 'system',
  opciones = OPCIONES_TEMA,
  alCambiar = () => {},
}: {
  inicial?: Preferencia;
  opciones?: readonly OpcionSelector<Preferencia>[];
  alCambiar?: (valor: Preferencia) => void;
}) {
  const [valor, setValor] = useState<Preferencia>(inicial);
  return (
    <SelectorTema
      valor={valor}
      opciones={opciones}
      onCambiar={(nuevo) => {
        setValor(nuevo);
        alCambiar(nuevo);
      }}
    />
  );
}

describe('SelectorTema', () => {
  it('es un grupo nombrado "Tema" hecho con fieldset y leyenda', () => {
    render(<Controlado />);
    const grupo = screen.getByRole('group', { name: 'Tema' });
    expect(grupo.tagName).toBe('FIELDSET');
    expect(grupo.querySelector('legend')).toHaveTextContent('Tema');
  });

  it('permite cambiar el nombre accesible del grupo', () => {
    render(
      <SelectorTema
        valor="light"
        opciones={OPCIONES_TEMA}
        onCambiar={() => {}}
        etiqueta="Apariencia"
      />,
    );
    expect(screen.getByRole('group', { name: 'Apariencia' })).toBeVisible();
  });

  it('muestra Claro, Sistema y Oscuro en ese orden, como radios', () => {
    render(<Controlado />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('value'))).toEqual([
      'light',
      'system',
      'dark',
    ]);
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeInTheDocument();
  });

  it('el nombre accesible no incluye el glifo decorativo', () => {
    render(<Controlado />);
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeInTheDocument();
    const glifos = document.querySelectorAll('[aria-hidden="true"]');
    expect(Array.from(glifos).map((g) => g.textContent)).toEqual([
      '☀',
      '◐',
      '☾',
    ]);
  });

  it.each([
    ['light', 'Claro'],
    ['system', 'Sistema'],
    ['dark', 'Oscuro'],
  ] as const)('con valor %s solo "%s" está marcada', (valor, nombre) => {
    render(<Controlado inicial={valor} />);
    const marcados = screen.getAllByRole('radio', { checked: true });
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toBe(screen.getByRole('radio', { name: nombre }));
  });

  it('todos los radios comparten un solo nombre de grupo', () => {
    render(<Controlado />);
    const nombres = new Set(
      screen.getAllByRole('radio').map((r) => r.getAttribute('name')),
    );
    expect(nombres.size).toBe(1);
    expect([...nombres][0]).toBeTruthy();
  });

  it('dos selectores en la misma página no comparten grupo', () => {
    render(
      <>
        <Controlado inicial="light" />
        <Controlado inicial="dark" />
      </>,
    );
    const radios = screen.getAllByRole('radio', { name: 'Claro' });
    expect(radios[0]?.getAttribute('name')).not.toBe(
      radios[1]?.getAttribute('name'),
    );
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(2);
  });

  it('al hacer clic llama a onCambiar con el valor elegido', async () => {
    const alCambiar = vi.fn();
    render(<Controlado alCambiar={alCambiar} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));
    expect(alCambiar).toHaveBeenCalledExactlyOnceWith('dark');
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
  });

  it('volver a elegir la opción marcada no llama a onCambiar', async () => {
    const alCambiar = vi.fn();
    render(<Controlado inicial="light" alCambiar={alCambiar} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('con Tab entra una sola vez al grupo, en la opción marcada', async () => {
    render(
      <>
        <button>antes</button>
        <Controlado inicial="system" />
        <button>después</button>
      </>,
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'después' })).toHaveFocus();
  });

  it('las flechas cambian la selección y llaman a onCambiar', async () => {
    const alCambiar = vi.fn();
    render(<Controlado inicial="light" alCambiar={alCambiar} />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
    expect(alCambiar.mock.calls.map(([v]) => v)).toEqual([
      'system',
      'dark',
      'system',
    ]);
  });

  it('una opción más en el arreglo se muestra sin cambiar el componente', async () => {
    const alCambiar = vi.fn();
    const ampliadas: readonly OpcionSelector<string>[] = [
      ...OPCIONES_TEMA,
      { valor: 'contraste', etiqueta: 'Alto contraste', glifo: '◑' },
    ];
    render(
      <SelectorTema
        valor="system"
        opciones={ampliadas}
        onCambiar={alCambiar}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    await userEvent.click(
      screen.getByRole('radio', { name: 'Alto contraste' }),
    );
    expect(alCambiar).toHaveBeenCalledExactlyOnceWith('contraste');
  });

  it('quitar una opción del arreglo la quita del control', () => {
    render(<Controlado opciones={OPCIONES_TEMA.slice(0, 2)} />);
    expect(screen.queryByRole('radio', { name: 'Oscuro' })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });
});
