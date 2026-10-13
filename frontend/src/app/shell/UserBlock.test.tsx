import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ETIQUETAS_ROL } from '@/shared/dominio';
import { UserBlock } from './UserBlock';

describe('UserBlock', () => {
  it('ordena los roles con ordenarRoles: admin antes que revisor', () => {
    render(<UserBlock nombre="Ana" roles={['revisor', 'admin']} />);
    expect(
      screen.getByText(`${ETIQUETAS_ROL.admin}, ${ETIQUETAS_ROL.revisor}`),
    ).toBeInTheDocument();
  });

  it('un solo rol muestra solo su etiqueta', () => {
    render(<UserBlock nombre="Ana" roles={['contador']} />);
    expect(screen.getByText(ETIQUETAS_ROL.contador)).toBeInTheDocument();
    expect(screen.queryByText(ETIQUETAS_ROL.admin)).toBeNull();
    expect(screen.queryByText(ETIQUETAS_ROL.revisor)).toBeNull();
  });

  it('etiqueta cada rol con la constante del dominio', () => {
    render(<UserBlock nombre="Ana" roles={['admin', 'contador', 'revisor']} />);
    expect(
      screen.getByText(
        [
          ETIQUETAS_ROL.admin,
          ETIQUETAS_ROL.contador,
          ETIQUETAS_ROL.revisor,
        ].join(', '),
      ),
    ).toBeInTheDocument();
  });

  it('muestra el nombre', () => {
    render(<UserBlock nombre="Luis Reyes" roles={['contador']} />);
    expect(screen.getByText('Luis Reyes')).toBeInTheDocument();
  });

  it('sin roles no dibuja la línea de roles', () => {
    const { container } = render(<UserBlock nombre="Ana" roles={[]} />);
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });
});

describe('UserBlock: cerrar sesión', () => {
  it('sin onCerrarSesion no hay botón', () => {
    render(<UserBlock nombre="Ana" roles={['admin']} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('con onCerrarSesion muestra el botón y lo llama una vez por clic', async () => {
    const onCerrarSesion = vi.fn();
    render(
      <UserBlock
        nombre="Ana"
        roles={['admin']}
        onCerrarSesion={onCerrarSesion}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    );
    expect(onCerrarSesion).toHaveBeenCalledOnce();
  });

  it('se alcanza con el teclado y Enter lo activa', async () => {
    const onCerrarSesion = vi.fn();
    render(
      <UserBlock
        nombre="Ana"
        roles={['admin']}
        onCerrarSesion={onCerrarSesion}
      />,
    );
    const usuario = userEvent.setup();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveFocus();
    await usuario.keyboard('{Enter}');
    expect(onCerrarSesion).toHaveBeenCalledOnce();
  });

  it('va después del nombre y de los roles', () => {
    render(
      <UserBlock nombre="Ana" roles={['admin']} onCerrarSesion={() => {}} />,
    );
    const boton = screen.getByRole('button');
    for (const antes of [
      screen.getByText('Ana'),
      screen.getByText(ETIQUETAS_ROL.admin),
    ]) {
      expect(
        antes.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('no explica en pantalla cómo se cancela la sesión', () => {
    const { container } = render(
      <UserBlock nombre="Ana" roles={['admin']} onCerrarSesion={() => {}} />,
    );
    expect(container.textContent).not.toMatch(/revoc|invalid|servidor/i);
  });
});
