import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
