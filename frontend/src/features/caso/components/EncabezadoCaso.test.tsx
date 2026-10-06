import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EncabezadoCaso, type EncabezadoCasoProps } from './EncabezadoCaso';

function dibujar(props: Partial<EncabezadoCasoProps> = {}) {
  return render(
    <MemoryRouter>
      <EncabezadoCaso
        estado="sugerencia"
        regla="referencia_monto_exacto"
        origen="regla"
        descripcion="SPEI MATERIALES REYES"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('EncabezadoCaso', () => {
  it('tiene el enlace de regreso a la bandeja', () => {
    dibujar();
    const enlace = screen.getByRole('link', {
      name: '← Volver a la bandeja',
    });
    expect(enlace).toHaveAttribute('href', '/bandeja');
  });

  it.each([
    ['sugerencia', '●', 'Sugerencia'],
    ['sin_match', '○', 'Sin match'],
    ['conciliado', '✓', 'Conciliado'],
  ] as const)(
    'el chip de %s lleva glifo y texto del espejo',
    (estado, glifo, texto) => {
      dibujar({ estado });
      const chip = screen.getByText(texto);
      expect(chip).toBeInTheDocument();
      const glifoEl = screen.getByText(glifo);
      expect(glifoEl).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('muestra la regla y el origen como chips cuando hay propuesta', () => {
    dibujar();
    expect(screen.getByText('referencia_monto_exacto')).toBeInTheDocument();
    expect(screen.getByText('origen: regla')).toBeInTheDocument();
  });

  it('el origen sale del mapa de etiquetas', () => {
    dibujar({ origen: 'llm', regla: 'llm_sugerencia' });
    expect(screen.getByText('origen: IA')).toBeInTheDocument();
  });

  it('sin regla ni origen no muestra esos chips', () => {
    dibujar({ estado: 'sin_match', regla: null, origen: null });
    expect(screen.queryByText(/origen:/)).toBeNull();
    expect(screen.queryByText('referencia_monto_exacto')).toBeNull();
  });

  it('una regla desconocida se muestra tal cual', () => {
    dibujar({ regla: 'regla_nueva_del_servidor' });
    expect(screen.getByText('regla_nueva_del_servidor')).toBeInTheDocument();
  });

  it('la descripción es un h2 y no hay ningún h1 (el h1 es del shell)', () => {
    dibujar();
    expect(
      screen.getByRole('heading', { level: 2, name: 'SPEI MATERIALES REYES' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('no muestra banco, cuenta, perfil ni aviso de solo lectura', () => {
    const { container } = dibujar();
    expect(container.textContent).not.toMatch(
      /banco|cuenta|perfil|solo lectura|solo puedes ver/i,
    );
  });
});
