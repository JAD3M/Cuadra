import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompanyBadge } from './CompanyBadge';

describe('CompanyBadge', () => {
  it('muestra nombre, RFC e iniciales', () => {
    render(
      <CompanyBadge razonSocial="Ferretería del Bajío" rfc="FDB190215QK4" />,
    );
    expect(screen.getByText('Ferretería del Bajío')).toBeInTheDocument();
    expect(screen.getByText('FDB190215QK4')).toBeInTheDocument();
    expect(screen.getByText('FB')).toBeInTheDocument();
  });

  it('las iniciales son decorativas', () => {
    render(
      <CompanyBadge razonSocial="Ferretería del Bajío" rfc="FDB190215QK4" />,
    );
    expect(screen.getByText('FB')).toHaveAttribute('aria-hidden', 'true');
  });

  it('es un grupo con nombre y no es interactivo', () => {
    const { container } = render(
      <CompanyBadge razonSocial="Ferretería del Bajío" rfc="FDB190215QK4" />,
    );
    expect(
      screen.getByRole('group', { name: 'Empresa activa' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
  });

  it('un nombre largo se conserva completo', () => {
    const nombre =
      'Comercializadora Internacional de Abarrotes y Ferretería del Bajío Sociedad Anónima';
    render(<CompanyBadge razonSocial={nombre} rfc="CIA190215QK4" />);
    expect(screen.getByText(nombre)).toBeInTheDocument();
  });
});
