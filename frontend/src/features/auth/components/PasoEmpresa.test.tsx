import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EmpresaElegible } from './ListaEmpresas';
import { PasoEmpresa, type PasoEmpresaProps } from './PasoEmpresa';

const EMPRESAS: EmpresaElegible[] = [
  {
    id: 'a',
    razonSocial: 'Ferretería del Bajío',
    rfc: 'FDB190215QK4',
    roles: ['contador'],
  },
];

function props(extra: Partial<PasoEmpresaProps> = {}): PasoEmpresaProps {
  return {
    saludo: 'Hola, Jorge. Tienes acceso a una empresa.',
    empresas: EMPRESAS,
    pendienteId: null,
    fallo: null,
    textoVolver: '← Cambiar de cuenta',
    onElegir: () => {},
    onVolver: () => {},
    ...extra,
  };
}

describe('PasoEmpresa', () => {
  it('muestra el paso, el título, el saludo y el enlace de volver', () => {
    render(<PasoEmpresa {...props()} />);
    expect(screen.getByText('Paso 2 de 2')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige empresa' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Hola, Jorge. Tienes acceso a una empresa.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '← Cambiar de cuenta' }),
    ).toBeInTheDocument();
  });

  it('es una región nombrada por su título', () => {
    render(<PasoEmpresa {...props()} />);
    expect(
      screen.getByRole('region', { name: 'Elige empresa' }),
    ).toBeInTheDocument();
  });

  it('no mueve el foco si no se pide', () => {
    render(<PasoEmpresa {...props()} />);
    expect(document.body).toHaveFocus();
  });

  it('enfoca el título al montarse cuando se pide', () => {
    render(<PasoEmpresa {...props({ enfocarTitulo: true })} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('con titulo h3 no crea un h1', () => {
    render(<PasoEmpresa {...props({ titulo: 'h3' })} />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('un fallo nuevo toma el foco; uno que ya estaba al montarse no', () => {
    const fallo = { titulo: 'Ya no tienes acceso a esta empresa.' };
    const { rerender } = render(<PasoEmpresa {...props({ fallo })} />);
    expect(screen.getByRole('alert')).not.toHaveFocus();

    rerender(<PasoEmpresa {...props({ fallo: null })} />);
    rerender(
      <PasoEmpresa
        {...props({
          fallo: { titulo: 'No se pudo conectar con el servidor.' },
        })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('llama a onElegir con el id y a onVolver', async () => {
    const onElegir = vi.fn();
    const onVolver = vi.fn();
    render(<PasoEmpresa {...props({ onElegir, onVolver })} />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: /Ferretería/ }));
    await usuario.click(
      screen.getByRole('button', { name: '← Cambiar de cuenta' }),
    );
    expect(onElegir).toHaveBeenCalledExactlyOnceWith('a');
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});
