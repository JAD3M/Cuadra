import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LISTA_CINCO_ESTADOS } from '@/test/fixturesCargas';
import { HistorialCargas } from './HistorialCargas';

describe('HistorialCargas', () => {
  it('es una sección con el h2 «Cargas recientes»', () => {
    render(<HistorialCargas vista="tabla" cargas={LISTA_CINCO_ESTADOS} />);
    const seccion = screen.getByRole('region', { name: 'Cargas recientes' });
    expect(seccion.tagName).toBe('SECTION');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cargas recientes' }),
    ).toBeInTheDocument();
  });

  it('cargando: esqueleto ocupado y ninguna tabla (1.1)', () => {
    render(<HistorialCargas vista="cargando" cargas={[]} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Cargando cargas')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('vacio: el texto de «Aún no hay cargas.» (1.2)', () => {
    render(<HistorialCargas vista="vacio" cargas={[]} />);
    expect(screen.getByText('Aún no hay cargas.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('tabla: la tabla con sus filas', () => {
    render(<HistorialCargas vista="tabla" cargas={LISTA_CINCO_ESTADOS} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('fallo: alerta con «Reintentar» que llama a onReintentar (1.3)', async () => {
    const onReintentar = vi.fn();
    render(
      <HistorialCargas vista="fallo" cargas={[]} onReintentar={onReintentar} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('sin_permiso: copy de permiso y sin «Reintentar»', () => {
    render(
      <HistorialCargas
        vista="sin_permiso"
        cargas={[]}
        onReintentar={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No tienes permiso para esta acción.',
    );
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('sin vista (401 o cancelación) solo queda el encabezado', () => {
    render(<HistorialCargas vista={null} cargas={[]} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cargas recientes' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('actualizando: la leyenda en el encabezado y ningún botón (G13)', () => {
    render(
      <HistorialCargas
        vista="tabla"
        cargas={LISTA_CINCO_ESTADOS}
        actualizacion="actualizando"
      />,
    );
    expect(
      screen.getByText('Se actualiza sola mientras procesa'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
  });

  it('detenida: el aviso y Actualizar en el encabezado, que llama a onActualizar (11.4)', async () => {
    const onActualizar = vi.fn();
    render(
      <HistorialCargas
        vista="tabla"
        cargas={LISTA_CINCO_ESTADOS}
        actualizacion="detenida"
        onActualizar={onActualizar}
      />,
    );
    expect(
      screen.getByText('La lista dejó de actualizarse.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(onActualizar).toHaveBeenCalledTimes(1);
  });

  it('sin actualización: ni leyenda ni aviso', () => {
    render(<HistorialCargas vista="tabla" cargas={LISTA_CINCO_ESTADOS} />);
    expect(screen.queryByText('Se actualiza sola mientras procesa')).toBeNull();
    expect(screen.queryByText('La lista dejó de actualizarse.')).toBeNull();
  });
});
