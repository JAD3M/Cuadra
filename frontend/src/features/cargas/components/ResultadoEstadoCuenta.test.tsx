import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoEstadoCuenta } from './ResultadoEstadoCuenta';

const FILAS = [
  { fila: 4, motivo: 'Monto inválido' },
  { fila: 17, motivo: 'Fecha vacía' },
];

describe('ResultadoEstadoCuenta', () => {
  it('el resumen: nuevos, ya existían, dudosos y con error, cada cifra sin partirse', () => {
    render(
      <ResultadoEstadoCuenta
        registros={98}
        existentes={0}
        dudosos={0}
        conError={2}
        filas={FILAS}
      />,
    );
    const resumen = screen.getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        el.textContent === '98 nuevos, 0 ya existían, 0 dudosos, 2 con error.',
    );
    for (const cifra of [
      within(resumen).getByText('98'),
      within(resumen).getByText('2'),
    ]) {
      expect(cifra.className).toMatch(/cifra/);
    }
  });

  const linea = (texto: string) =>
    screen.getByText(
      (_, el) => el?.tagName === 'P' && el.textContent === texto,
    );

  it('los nuevos son los registros que entraron menos los dudosos', () => {
    render(
      <ResultadoEstadoCuenta
        registros={207}
        existentes={4}
        dudosos={1}
        conError={2}
        filas={[]}
      />,
    );
    expect(
      linea('206 nuevos, 4 ya existían, 1 dudoso, 2 con error.'),
    ).toBeVisible();
  });

  it.each([
    [0, 1, 0, '0 nuevos, 1 ya existía, 0 dudosos, 0 con error.'],
    [1, 0, 0, '1 nuevo, 0 ya existían, 0 dudosos, 0 con error.'],
    [3, 2, 2, '1 nuevo, 2 ya existían, 2 dudosos, 0 con error.'],
  ])(
    'plurales correctos con %i registros, %i existentes y %i dudosos',
    (registros, existentes, dudosos, esperado) => {
      render(
        <ResultadoEstadoCuenta
          registros={registros}
          existentes={existentes}
          dudosos={dudosos}
          conError={0}
          filas={[]}
        />,
      );
      expect(linea(esperado)).toBeVisible();
    },
  );

  it('con dudosos: el aviso ámbar dice que quedaron pendientes y no se concilian', () => {
    render(
      <ResultadoEstadoCuenta
        registros={207}
        existentes={4}
        dudosos={1}
        conError={2}
        filas={[]}
      />,
    );
    expect(
      screen.getByText(
        '⚠ 1 dudoso quedó pendiente de revisión: misma cuenta, fecha y monto que uno ya cargado, con otra referencia. No se concilia hasta que se revise.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText('Los 4 que ya existían se omitieron.'),
    ).toBeVisible();
  });

  it('con varios dudosos el aviso va en plural', () => {
    render(
      <ResultadoEstadoCuenta
        registros={5}
        existentes={1}
        dudosos={3}
        conError={0}
        filas={[]}
      />,
    );
    expect(
      screen.getByText(
        '⚠ 3 dudosos quedaron pendientes de revisión: misma cuenta, fecha y monto que otros ya cargados, con otra referencia. No se concilian hasta que se revisen.',
      ),
    ).toBeVisible();
    expect(screen.getByText('El que ya existía se omitió.')).toBeVisible();
  });

  it('sin dudosos ni existentes no hay leyenda', () => {
    render(
      <ResultadoEstadoCuenta
        registros={98}
        existentes={0}
        dudosos={0}
        conError={2}
        filas={[]}
      />,
    );
    expect(screen.queryByText(/⚠/)).toBeNull();
    expect(screen.queryByText(/se omitieron|se omitió/)).toBeNull();
  });

  it('solo existentes: sin ⚠, y dice que se omitieron', () => {
    render(
      <ResultadoEstadoCuenta
        registros={0}
        existentes={5}
        dudosos={0}
        conError={0}
        filas={[]}
      />,
    );
    expect(screen.queryByText(/⚠/)).toBeNull();
    expect(
      screen.getByText('Los 5 que ya existían se omitieron.'),
    ).toBeVisible();
  });

  it('una línea por fila rechazada: «Fila {n}: {motivo}»', () => {
    render(
      <ResultadoEstadoCuenta
        registros={98}
        existentes={0}
        dudosos={0}
        conError={2}
        filas={FILAS}
      />,
    );
    const items = within(
      screen.getByRole('region', { name: 'Filas con error' }),
    ).getAllByRole('listitem');
    expect(items.map((i) => i.textContent?.replace('✕', ''))).toEqual([
      'Fila 4: Monto inválido',
      'Fila 17: Fecha vacía',
    ]);
  });

  it('las filas buenas no se listan: sin errores no hay lista', () => {
    render(
      <ResultadoEstadoCuenta
        registros={210}
        existentes={0}
        dudosos={0}
        conError={0}
        filas={[]}
      />,
    );
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByText('210')).toBeInTheDocument();
  });

  it('el motivo es texto plano (8.7)', () => {
    const { container } = render(
      <ResultadoEstadoCuenta
        registros={1}
        existentes={0}
        dudosos={0}
        conError={1}
        filas={[{ fila: 2, motivo: '<img src=x onerror=alert(1)>' }]}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('Fila 2: <img src=x onerror=alert(1)>');
  });

  it('la región se desplaza con el teclado y no se anuncia entera', () => {
    render(
      <ResultadoEstadoCuenta
        registros={98}
        existentes={0}
        dudosos={0}
        conError={2}
        filas={FILAS}
      />,
    );
    const region = screen.getByRole('region', { name: 'Filas con error' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveAttribute('aria-live', 'off');
  });

  it('no muestra la cuenta ni controles para cerrar (6.4, M13)', () => {
    render(
      <ResultadoEstadoCuenta
        registros={98}
        existentes={0}
        dudosos={0}
        conError={2}
        filas={FILAS}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
