import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PERFILES } from '@/test/fixturesCargas';
import { CampoPerfil } from './CampoPerfil';

describe('CampoPerfil', () => {
  it('opciones con el id, en el orden de la API, con el valor elegido', () => {
    render(
      <CampoPerfil
        perfiles={PERFILES}
        valor="cuadra"
        onCambiar={() => undefined}
      />,
    );
    const select = screen.getByLabelText('Perfil de lectura');
    expect(select).toHaveValue('cuadra');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'cuadra',
      'banco-norte',
      'banco-sur',
    ]);
  });

  it('entrega el id elegido (M13, CRG-4.4)', async () => {
    const onCambiar = vi.fn();
    render(
      <CampoPerfil perfiles={PERFILES} valor="cuadra" onCambiar={onCambiar} />,
    );
    await userEvent
      .setup()
      .selectOptions(screen.getByLabelText('Perfil de lectura'), 'banco-sur');
    expect(onCambiar).toHaveBeenCalledWith('banco-sur');
  });

  it('mientras los perfiles cargan el campo no se muestra', () => {
    const { container } = render(
      <CampoPerfil perfiles={undefined} valor="" onCambiar={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('con fallo el select sigue visible pero deshabilitado, con el aviso y Reintentar (mockup)', () => {
    render(
      <CampoPerfil
        perfiles={undefined}
        fallo
        valor=""
        onCambiar={() => undefined}
        onReintentar={() => undefined}
      />,
    );
    const select = screen.getByLabelText('Perfil de lectura');
    expect(select).toBeVisible();
    expect(select).toBeDisabled();
    expect(
      screen.getByText('No se pudieron cargar los perfiles.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
  });

  it('con fallo el aviso queda ligado al select con aria-describedby', () => {
    render(
      <CampoPerfil
        perfiles={undefined}
        fallo
        valor=""
        onCambiar={() => undefined}
        onReintentar={() => undefined}
      />,
    );
    expect(
      screen.getByLabelText('Perfil de lectura'),
    ).toHaveAccessibleDescription(/No se pudieron cargar los perfiles\./);
  });

  it('Reintentar llama a onReintentar una vez por clic', async () => {
    const onReintentar = vi.fn();
    render(
      <CampoPerfil
        perfiles={undefined}
        fallo
        valor=""
        onCambiar={() => undefined}
        onReintentar={onReintentar}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('Reintentar es un botón que no envía formularios', () => {
    render(
      <CampoPerfil
        perfiles={undefined}
        fallo
        valor=""
        onCambiar={() => undefined}
        onReintentar={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('sin fallo no hay aviso ni Reintentar y el select no tiene descripción', () => {
    render(
      <CampoPerfil
        perfiles={PERFILES}
        valor="cuadra"
        onCambiar={() => undefined}
        onReintentar={() => undefined}
      />,
    );
    expect(
      screen.queryByText('No se pudieron cargar los perfiles.'),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.getByLabelText('Perfil de lectura')).toBeEnabled();
    expect(
      screen.getByLabelText('Perfil de lectura'),
    ).not.toHaveAccessibleDescription();
  });

  it('con fallo y rol de solo lectura Reintentar sigue disponible (no sube nada)', () => {
    render(
      <CampoPerfil
        perfiles={undefined}
        fallo
        deshabilitado
        valor=""
        onCambiar={() => undefined}
        onReintentar={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Perfil de lectura')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();
  });

  it('una lista vacía tampoco se muestra', () => {
    const { container } = render(
      <CampoPerfil perfiles={[]} valor="" onCambiar={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('deshabilitado: el select lo está', () => {
    render(
      <CampoPerfil
        perfiles={PERFILES}
        valor="cuadra"
        deshabilitado
        onCambiar={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Perfil de lectura')).toBeDisabled();
  });
});
