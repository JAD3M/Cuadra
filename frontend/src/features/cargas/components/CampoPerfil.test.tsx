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

  it('sin perfiles (fallo de carga) el campo no se muestra (4.5, G9)', () => {
    const { container } = render(
      <CampoPerfil perfiles={undefined} valor="" onCambiar={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
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
