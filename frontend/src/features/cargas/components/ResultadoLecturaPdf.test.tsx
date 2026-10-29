import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ResultadoLecturaPdf } from './ResultadoLecturaPdf';

const LECTURA = {
  movimientosLeidos: 14,
  saldoInicial: '10000.00',
  saldoFinal: '11250.50',
  estado: 'pendiente_vista_previa',
  cargaId: '0192a3f4-0000-7000-8000-0000000000c1',
} as const;

const montar = (props: Parameters<typeof ResultadoLecturaPdf>[0]) =>
  render(
    <MemoryRouter>
      <ResultadoLecturaPdf {...props} />
    </MemoryRouter>,
  );

describe('ResultadoLecturaPdf (PDF guardado, historia 3.3)', () => {
  it('dice cuántos movimientos se leyeron y que los saldos cuadran', () => {
    const { container } = montar(LECTURA);
    expect(container).toHaveTextContent(
      '14 movimientos leídos. Los saldos cuadran.',
    );
  });

  it('muestra los saldos con formato, sin signo de peso', () => {
    montar(LECTURA);
    expect(screen.getByText('Saldo inicial')).toBeInTheDocument();
    expect(screen.getByText('Saldo final')).toBeInTheDocument();
    expect(screen.getByText('10,000.00')).toBeInTheDocument();
    expect(screen.getByText('11,250.50')).toBeInTheDocument();
  });

  it('un saldo grande conserva todos sus dígitos (nunca pasa por flotante)', () => {
    montar({
      ...LECTURA,
      saldoInicial: '12345678901234567.89',
      saldoFinal: '-0.10',
    });
    expect(screen.getByText('12,345,678,901,234,567.89')).toBeInTheDocument();
    expect(screen.getByText('−0.10')).toBeInTheDocument();
  });

  it('lleva el chip con el estado del servidor y la pista de que están en espera', () => {
    montar(LECTURA);
    expect(screen.getByText('Pendiente de vista previa')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Los movimientos quedan en espera: todavía no entran a conciliación.',
      ),
    ).toBeInTheDocument();
  });

  it('no hay advertencia de líneas no leídas: un PDF guardado no las tiene', () => {
    montar(LECTURA);
    expect(screen.queryByText('⚠')).not.toBeInTheDocument();
    expect(screen.queryByText(/líneas no leídas/)).not.toBeInTheDocument();
  });
});

describe('ResultadoLecturaPdf: revisar la vista previa (historia 3.4)', () => {
  it('después de la pista, un enlace «Revisar vista previa» a la vista previa de esa carga', () => {
    const { container } = montar(LECTURA);
    const enlace = screen.getByRole('link', { name: 'Revisar vista previa' });
    expect(enlace).toHaveAttribute(
      'href',
      `/cargas/${LECTURA.cargaId}/vista-previa`,
    );
    const pista = screen.getByText(
      'Los movimientos quedan en espera: todavía no entran a conciliación.',
    );
    expect(
      pista.compareDocumentPosition(enlace) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container).toBeVisible();
  });

  it('si la carga ya no espera (ya existía y se procesó) no hay nada que revisar', () => {
    montar({ ...LECTURA, estado: 'procesada' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('el id de la carga va codificado en la ruta', () => {
    montar({ ...LECTURA, cargaId: 'a b/c' });
    expect(
      screen.getByRole('link', { name: 'Revisar vista previa' }),
    ).toHaveAttribute('href', '/cargas/a%20b%2Fc/vista-previa');
  });
});
