import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TarjetaCfdi } from './TarjetaCfdi';

// Sin anotación: lleva campos que el contrato trae y la tarjeta no debe mostrar.
const CFDI = {
  uuidFiscal: '6F1C2A9E-4B7D-4E21-9C3A-0D8E51B7A044',
  serie: 'A',
  folio: '1044',
  nombreEmisor: 'MATERIALES REYES SA DE CV',
  rfcReceptor: 'XAXX010101000',
  nombreReceptor: 'Publico en General',
  fechaEmision: '2026-09-02',
  total: '18560.0000',
  moneda: 'MXN',
  metodoPago: 'PUE',
};

describe('TarjetaCfdi', () => {
  it('muestra UUID, emisión, serie-folio y total', () => {
    render(<TarjetaCfdi cfdi={CFDI} />);
    expect(screen.getByText('CFDI candidato')).toBeInTheDocument();
    expect(
      screen.getByText('6F1C2A9E-4B7D-4E21-9C3A-0D8E51B7A044'),
    ).toBeInTheDocument();
    expect(screen.getByText('2026-09-02')).toBeInTheDocument();
    expect(screen.getByText('A-1044')).toBeInTheDocument();
    expect(screen.getByText('$18,560.00')).toBeInTheDocument();
  });

  it('con moneda base muestra «MXN · PUE» bajo el total', () => {
    render(<TarjetaCfdi cfdi={CFDI} />);
    expect(screen.getByText('MXN · PUE')).toBeInTheDocument();
  });

  it('con otra moneda el código va junto al total y el método de pago solo', () => {
    render(
      <TarjetaCfdi cfdi={{ ...CFDI, total: '2150.0000', moneda: 'USD' }} />,
    );
    expect(screen.getByText('$2,150.00 USD')).toBeInTheDocument();
    expect(screen.getByText('PUE')).toBeInTheDocument();
    expect(screen.queryByText(/MXN/)).toBeNull();
  });

  it('sin método de pago no inventa uno', () => {
    render(<TarjetaCfdi cfdi={{ ...CFDI, metodoPago: null }} />);
    expect(screen.getByText('MXN')).toBeInTheDocument();
    expect(screen.queryByText(/PUE|PPD/)).toBeNull();
  });

  it('B13: no muestra emisor ni receptor (no están en la maqueta)', () => {
    render(<TarjetaCfdi cfdi={CFDI} />);
    expect(screen.queryByText('Emisor')).toBeNull();
    expect(screen.queryByText('Receptor')).toBeNull();
    expect(screen.queryByText('MATERIALES REYES SA DE CV')).toBeNull();
    expect(screen.queryByText(/Publico en General/)).toBeNull();
    expect(screen.queryByText('XAXX010101000')).toBeNull();
  });

  it('sin serie ni folio muestra un guion', () => {
    render(<TarjetaCfdi cfdi={{ ...CFDI, serie: null, folio: null }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('B14: la marca ✓ de serie-folio solo sale cuando la regla lo indica', () => {
    const { rerender } = render(<TarjetaCfdi cfdi={CFDI} />);
    expect(screen.queryByText('✓')).toBeNull();
    rerender(<TarjetaCfdi cfdi={CFDI} serieFolioCoincide />);
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('A-1044').closest('dd')).toHaveTextContent(
      'A-1044 ✓',
    );
  });

  it('B14: la marca es decorativa y el coincidir queda dicho solo a lectores', () => {
    render(<TarjetaCfdi cfdi={CFDI} serieFolioCoincide />);
    expect(screen.getByText('✓')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('coincide con el movimiento')).toBeInTheDocument();
  });

  it('serie sin folio muestra solo la parte que existe', () => {
    render(<TarjetaCfdi cfdi={{ ...CFDI, folio: null }} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
