import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KpiBandeja, type KpiBandejaProps } from './KpiBandeja';

const CONTEOS = { sugerencia: 26, sin_match: 13, conciliado: 4 };

function montar(props: Partial<KpiBandejaProps> = {}) {
  const onReintentar = vi.fn();
  const resultado = render(
    <KpiBandeja
      estado="listo"
      conteos={CONTEOS}
      montoPorRevisar={[{ moneda: 'MXN', monto: '138990.4000' }]}
      onReintentar={onReintentar}
      {...props}
    />,
  );
  return { onReintentar, ...resultado };
}

describe('KpiBandeja: cargado', () => {
  it('muestra los tres conteos con sus rótulos y subrótulos', () => {
    montar();
    for (const [etiqueta, detalle, cuenta] of [
      ['Sugerencias', 'esperan que confirmes o rechaces', '26'],
      ['Sin match', 'el motor no encontró un CFDI seguro', '13'],
      ['Conciliados', 'confirmados por una persona', '4'],
    ]) {
      const tile = screen.getByText(etiqueta as string).parentElement;
      if (tile === null) throw new Error(`Sin tile ${etiqueta}`);
      expect(within(tile).getByText(cuenta as string)).toBeInTheDocument();
      expect(within(tile).getByText(detalle as string)).toBeInTheDocument();
    }
  });

  it('un monto en MXN va sin código y con el pie de MXN', () => {
    montar();
    expect(screen.getByText('Monto por revisar')).toBeInTheDocument();
    expect(screen.getByText('$138,990.40')).toBeInTheDocument();
    expect(
      screen.getByText('MXN en sugerencias y sin match'),
    ).toBeInTheDocument();
  });

  it('con dos monedas muestra una línea por moneda, cada una con su código', () => {
    montar({
      montoPorRevisar: [
        { moneda: 'MXN', monto: '136840.4000' },
        { moneda: 'USD', monto: '2150.0000' },
      ],
    });
    expect(screen.getByText('$136,840.40 MXN')).toBeInTheDocument();
    expect(screen.getByText('$2,150.00 USD')).toBeInTheDocument();
    expect(screen.getByText('En sugerencias y sin match')).toBeInTheDocument();
    expect(
      screen.queryByText('MXN en sugerencias y sin match'),
    ).not.toBeInTheDocument();
  });

  it('una única moneda distinta de MXN muestra su código', () => {
    montar({ montoPorRevisar: [{ moneda: 'USD', monto: '2150.0000' }] });
    expect(screen.getByText('$2,150.00 USD')).toBeInTheDocument();
    expect(screen.getByText('En sugerencias y sin match')).toBeInTheDocument();
  });

  it('sin montos por revisar muestra $0.00 con el pie de MXN', () => {
    montar({ montoPorRevisar: [] });
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(
      screen.getByText('MXN en sugerencias y sin match'),
    ).toBeInTheDocument();
  });

  it('un cero legítimo se muestra como 0', () => {
    montar({ conteos: { sugerencia: 0, sin_match: 0, conciliado: 0 } });
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.queryByText('No disponible')).not.toBeInTheDocument();
  });

  it('un monto de 15 dígitos es un solo nodo de texto', () => {
    montar({
      montoPorRevisar: [{ moneda: 'MXN', monto: '999999999999999.9900' }],
    });
    const monto = screen.getByText('$999,999,999,999,999.99');
    expect(monto.childNodes).toHaveLength(1);
    expect(monto.childNodes[0]?.nodeType).toBe(Node.TEXT_NODE);
  });

  it('no abre un landmark propio: sin region ni sección etiquetada', () => {
    montar();
    for (const rol of [
      'region',
      'navigation',
      'main',
      'banner',
      'complementary',
    ]) {
      expect(screen.queryByRole(rol)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('no marca ocupado ni muestra botón de reintento', () => {
    const { container } = montar();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('KpiBandeja: cargando', () => {
  it('es un esqueleto ocupado sin dígitos', () => {
    const { container } = montar({
      estado: 'cargando',
      conteos: undefined,
      montoPorRevisar: undefined,
    });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container).not.toHaveTextContent(/\d/);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });
});

describe('KpiBandeja: error', () => {
  it('los conteos y el monto muestran —, nunca 0, con texto oculto', () => {
    const { container } = montar({
      estado: 'error',
      conteos: undefined,
      montoPorRevisar: undefined,
    });
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.getAllByText('No disponible')).toHaveLength(4);
    expect(container).not.toHaveTextContent(/\d/);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('un único botón Reintentar llama a onReintentar', async () => {
    const { onReintentar } = montar({
      estado: 'error',
      conteos: undefined,
      montoPorRevisar: undefined,
    });
    const botones = screen.getAllByRole('button');
    expect(botones).toHaveLength(1);
    expect(botones[0]).toHaveAccessibleName('Reintentar');
    await userEvent.click(botones[0] as HTMLElement);
    expect(onReintentar).toHaveBeenCalledOnce();
  });
});
