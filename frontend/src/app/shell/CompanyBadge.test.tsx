import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('CompanyBadge como botón de cambio', () => {
  const DATOS = { razonSocial: 'Ferretería del Bajío', rfc: 'FDB190215QK4' };

  it('es un botón con nombre accesible completo y sin grupo', () => {
    render(<CompanyBadge {...DATOS} onCambiar={() => {}} />);
    expect(
      screen.getByRole('button', {
        name: 'Cambiar de empresa. Empresa activa: Ferretería del Bajío FDB190215QK4',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('muestra nombre, RFC, iniciales y una flecha decorativa', () => {
    const { container } = render(
      <CompanyBadge {...DATOS} onCambiar={() => {}} />,
    );
    expect(screen.getByText('FDB190215QK4')).toBeInTheDocument();
    expect(screen.getByText('FB')).toHaveAttribute('aria-hidden', 'true');
    const flecha = container.querySelector('svg');
    expect(flecha).toHaveAttribute('aria-hidden', 'true');
    expect(flecha).toHaveAttribute('focusable', 'false');
  });

  it('un clic y Enter piden el cambio', async () => {
    const usuario = userEvent.setup();
    const onCambiar = vi.fn();
    render(<CompanyBadge {...DATOS} onCambiar={onCambiar} />);
    const boton = screen.getByRole('button');
    await usuario.click(boton);
    boton.focus();
    await usuario.keyboard('{Enter}');
    expect(onCambiar).toHaveBeenCalledTimes(2);
  });

  it('pendiente: aria-busy, aria-disabled y no repite el cambio', async () => {
    const usuario = userEvent.setup();
    const onCambiar = vi.fn();
    render(<CompanyBadge {...DATOS} onCambiar={onCambiar} pendiente />);
    const boton = screen.getByRole('button');
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(boton).toHaveAttribute('aria-busy', 'true');
    await usuario.click(boton);
    expect(onCambiar).not.toHaveBeenCalled();
  });

  it('sin pendiente no lleva aria-disabled ni aria-busy', () => {
    render(<CompanyBadge {...DATOS} onCambiar={() => {}} />);
    const boton = screen.getByRole('button');
    expect(boton).not.toHaveAttribute('aria-disabled');
    expect(boton).not.toHaveAttribute('aria-busy');
  });

  it('con una sola empresa (sin onCambiar) no es enfocable ni está en el árbol como botón', () => {
    const { container } = render(<CompanyBadge {...DATOS} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByText(/Cambiar de empresa/)).toBeNull();
  });
});
