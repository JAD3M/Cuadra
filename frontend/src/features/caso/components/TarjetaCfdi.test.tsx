import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TarjetaCfdi, type CfdiTarjeta } from './TarjetaCfdi';

const CFDI: CfdiTarjeta = {
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
  it('muestra emisor, receptor, UUID, emisión, serie-folio y total', () => {
    render(<TarjetaCfdi cfdi={CFDI} />);
    expect(screen.getByText('CFDI candidato')).toBeInTheDocument();
    expect(screen.getByText('MATERIALES REYES SA DE CV')).toBeInTheDocument();
    expect(screen.getByText(/Publico en General/)).toBeInTheDocument();
    expect(screen.getByText('XAXX010101000')).toBeInTheDocument();
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

  it('los campos opcionales nulos muestran un guion', () => {
    render(
      <TarjetaCfdi
        cfdi={{
          ...CFDI,
          serie: null,
          folio: null,
          nombreEmisor: null,
          nombreReceptor: null,
        }}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('XAXX010101000')).toBeInTheDocument();
  });

  it('serie sin folio muestra solo la parte que existe', () => {
    render(<TarjetaCfdi cfdi={{ ...CFDI, folio: null }} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
