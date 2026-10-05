import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ListaEmpresas,
  type EmpresaElegible,
  type ListaEmpresasProps,
} from './ListaEmpresas';

const EMPRESAS: EmpresaElegible[] = [
  {
    id: 'a',
    razonSocial: 'Ferretería del Bajío',
    rfc: 'FDB190215QK4',
    roles: ['contador'],
  },
  {
    id: 'b',
    razonSocial: 'Transportes Cuautla',
    rfc: 'TCU170830R52',
    roles: ['revisor', 'admin'],
  },
  {
    id: 'c',
    razonSocial: 'Abarrotes del Norte',
    rfc: 'ADN200310AB1',
    roles: ['admin'],
  },
  {
    id: 'd',
    razonSocial: 'Cuarta Empresa',
    rfc: 'CEM200310AB1',
    roles: ['revisor'],
  },
];

function montar(extra: Partial<ListaEmpresasProps> = {}) {
  const onElegir = vi.fn();
  render(
    <ListaEmpresas
      empresas={EMPRESAS}
      pendienteId={null}
      onElegir={onElegir}
      {...extra}
    />,
  );
  return { onElegir };
}

describe('ListaEmpresas', () => {
  it('es una lista con un elemento por empresa y un botón en cada uno', () => {
    montar();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(within(item).getAllByRole('button')).toHaveLength(1);
    }
  });

  it('respeta el orden recibido', () => {
    montar();
    const nombres = screen
      .getAllByRole('button')
      .map((boton) => boton.textContent);
    expect(nombres[0]).toContain('Ferretería del Bajío');
    expect(nombres[3]).toContain('Cuarta Empresa');
  });

  it('reparte los tonos decorativos en ciclo por posición', () => {
    montar();
    const tonos = screen
      .getAllByRole('listitem')
      .map(
        (item) =>
          within(item).getAllByText(/Administrador|Contador|Revisor/)[0],
      )
      .map((chip) => chip?.getAttribute('data-tono'));
    expect(tonos).toEqual([
      'sugerencia',
      'sin_match',
      'conciliado',
      'sugerencia',
    ]);
  });

  it('ordena los roles de cada empresa', () => {
    montar();
    const segunda = screen.getAllByRole('listitem')[1];
    const chips = within(segunda as HTMLElement)
      .getAllByText(/Administrador|Contador|Revisor/)
      .map((chip) => chip.textContent);
    expect(chips).toEqual(['Administrador', 'Revisor']);
  });

  it('elige la empresa con su id', async () => {
    const { onElegir } = montar();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /Transportes Cuautla/ }));
    expect(onElegir).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('una sola empresa también se muestra', () => {
    montar({ empresas: [EMPRESAS[0] as EmpresaElegible] });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('en reposo no está ocupada', () => {
    montar();
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'false');
  });

  it('con una petición en curso: lista ocupada, la elegida entra y las demás se inactivan', async () => {
    const { onElegir } = montar({ pendienteId: 'b' });
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    const botones = screen.getAllByRole('button');
    expect(botones[1]).toHaveTextContent('Entrando…');
    expect(botones.map((b) => b.getAttribute('aria-disabled'))).toEqual([
      'true',
      'true',
      'true',
      'true',
    ]);
    expect(botones[0]).not.toHaveTextContent('Entrando…');
    await userEvent.setup().click(botones[0] as HTMLElement);
    await userEvent.setup().click(botones[1] as HTMLElement);
    expect(onElegir).not.toHaveBeenCalled();
  });

  it('se nombra con el encabezado indicado', () => {
    render(
      <>
        <h2 id="titulo">Elige empresa</h2>
        <ListaEmpresas
          empresas={EMPRESAS}
          pendienteId={null}
          onElegir={() => {}}
          etiquetadaPor="titulo"
        />
      </>,
    );
    expect(
      screen.getByRole('list', { name: 'Elige empresa' }),
    ).toBeInTheDocument();
  });

  it('una lista vacía no dibuja elementos', () => {
    montar({ empresas: [] });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
