import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Header } from './Header';

const EMPRESA = { razonSocial: 'Ferretería del Bajío', rfc: 'FDB190215QK4' };

describe('Header', () => {
  it('muestra el título como único h1', () => {
    render(<Header titulo="Bandeja de revisión" empresa={EMPRESA} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bandeja de revisión' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('muestra el subtítulo solo cuando se pasa', () => {
    const { rerender } = render(<Header titulo="Cargas" empresa={EMPRESA} />);
    expect(screen.queryByText('Historial de archivos')).toBeNull();
    rerender(
      <Header
        titulo="Cargas"
        subtitulo="Historial de archivos"
        empresa={EMPRESA}
      />,
    );
    expect(screen.getByText('Historial de archivos')).toBeInTheDocument();
  });

  it('incluye la insignia de la empresa', () => {
    render(<Header titulo="Cargas" empresa={EMPRESA} />);
    expect(screen.getByText('FDB190215QK4')).toBeInTheDocument();
  });

  it('dibuja la barra móvil antes del título cuando existe', () => {
    render(
      <Header
        titulo="Cargas"
        empresa={EMPRESA}
        barraMovil={<div data-testid="barra">menú</div>}
      />,
    );
    const barra = screen.getByTestId('barra');
    const titulo = screen.getByRole('heading', { name: 'Cargas' });
    expect(
      barra.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
