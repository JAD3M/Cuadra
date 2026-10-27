import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Rol } from '@/shared/dominio';
import { EditorRoles } from './EditorRoles';

// Historia 2.6: el editor de roles de una fila activa, sobre
// `Usuarios.dc.html` (vistas `editar_roles` y `editar_roles_vacio`).

const CORREO = 'luis.reyes@ferreteria.mx';

function montar(
  seleccion: readonly Rol[] = ['contador'],
  extra: { ocupado?: boolean } = {},
) {
  const alternar = vi.fn();
  const guardar = vi.fn();
  const cancelar = vi.fn();
  render(
    <EditorRoles
      correo={CORREO}
      seleccion={seleccion}
      ocupado={extra.ocupado ?? false}
      onAlternar={alternar}
      onGuardar={guardar}
      onCancelar={cancelar}
    />,
  );
  return { alternar, guardar, cancelar };
}

describe('EditorRoles', () => {
  it('es un formulario con un grupo «Roles de <correo>» y los cuatro roles con su descripción', () => {
    montar();
    expect(
      screen.getByRole('form', { name: 'Cambiar roles' }),
    ).toBeInTheDocument();
    const grupo = screen.getByRole('group', { name: `Roles de ${CORREO}` });
    expect(grupo).toBeInTheDocument();
    const casillas = screen.getAllByRole('checkbox');
    expect(casillas.map((c) => c.closest('label')?.textContent)).toEqual([
      'AdministradorTodo: cargas, confirmar y rechazar, tolerancia, bitácora y usuarios.',
      'ContadorSube cargas, confirma y rechaza casos; ve la tolerancia sin cambiarla.',
      'RevisorConfirma y rechaza casos y consulta la bitácora; no sube cargas.',
      'AuditorSolo lectura de la bandeja y la bitácora.',
    ]);
  });

  it('marca solo los roles de la selección', () => {
    montar(['contador', 'revisor']);
    expect(screen.getByRole('checkbox', { name: /^Contador/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Revisor/ })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /^Administrador/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /^Auditor/ }),
    ).not.toBeChecked();
  });

  it('el foco entra en la primera casilla al abrirse', () => {
    montar();
    expect(screen.getAllByRole('checkbox')[0]).toHaveFocus();
  });

  it('alternar una casilla avisa con su rol', async () => {
    const { alternar } = montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole('checkbox', { name: /^Auditor/ }));
    await u.click(screen.getByRole('checkbox', { name: /^Contador/ }));
    expect(alternar.mock.calls).toEqual([['auditor'], ['contador']]);
  });

  it('con roles dice «Guardar cambios», la nota de la siguiente petición y no avisa de quitar', () => {
    montar(['contador']);
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El cambio aplica en su siguiente petición.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sin ningún rol avisa que pierde el acceso y el botón pasa a «Guardar y quitar acceso»', () => {
    montar([]);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin ningún rol, la persona pierde el acceso a tu empresa. Conserva sus roles en otras empresas.',
    );
    expect(
      screen.getByRole('button', { name: 'Guardar y quitar acceso' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Guardar cambios' }),
    ).toBeNull();
  });

  it('guardar envía el formulario una vez; Cancelar solo cierra', async () => {
    const { guardar, cancelar } = montar();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(cancelar).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cancelar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('Enter en una casilla envía el formulario', async () => {
    const { guardar } = montar();
    const u = userEvent.setup();
    await u.keyboard('{Enter}');
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('mientras hay una acción en vuelo todo queda apagado y no envía', async () => {
    const { guardar, alternar } = montar(['contador'], { ocupado: true });
    const u = userEvent.setup();
    for (const casilla of screen.getAllByRole('checkbox')) {
      expect(casilla).toBeDisabled();
    }
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await u.click(screen.getByRole('checkbox', { name: /^Auditor/ }));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(guardar).not.toHaveBeenCalled();
    expect(alternar).not.toHaveBeenCalled();
  });
});
