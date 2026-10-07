import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from '@/shared/tema';
import seccionBitacoraFuente from '@/features/kit/SeccionBitacora.tsx?raw';
import { RutaKit } from './RutaKit';

// La sección «Bitácora» de la galería vive en su propio archivo de pruebas
// para no editar `RutaKit.test.tsx`, que guarda las pruebas de las demás
// secciones (entre ellas la de tolerancia).

function renderizar() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/__kit']}>
        <RutaKit />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const seccion = () => screen.getByRole('region', { name: 'Bitácora' });

/** Las nueve vistas de la maqueta (Bitacora.dc.html). */
const VISTAS = [
  'normal',
  'cargando',
  'vacio',
  'vacio_filtros',
  'rango_invalido',
  'error_conexion',
  'error_permiso',
  'error_otro',
  'usuarios_error',
];

/** El bloque de una vista: el contenedor de su encabezado h3. */
function bloque(vista: string): HTMLElement {
  const titulo = within(seccion()).getByRole('heading', {
    level: 3,
    name: `Vista: ${vista}`,
  });
  return titulo.parentElement as HTMLElement;
}

describe('RutaKit: sección Bitácora', () => {
  it('tiene su encabezado y las nueve vistas de la maqueta, en orden', () => {
    renderizar();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Bitácora' }),
    ).toBeInTheDocument();
    const titulos = within(seccion())
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titulos).toEqual(VISTAS.map((v) => `Vista: ${v}`));
  });

  it('cada vista lleva el formulario de filtros y ningún h1', () => {
    renderizar();
    expect(within(seccion()).getAllByRole('form')).toHaveLength(9);
    expect(within(seccion()).queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('normal: siete filas con las horas de la maqueta y el acceso denegado marcado', () => {
    renderizar();
    const tabla = within(bloque('normal')).getByRole('table');
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(7);
    expect(within(filas[0]!).getByText('2026-09-18 16:02')).toBeInTheDocument();
    expect(filas[1]!.className).toMatch(/filaDenegada/);
    expect(
      within(bloque('normal')).getByText('Mostrando 1–50 de 312'),
    ).toBeInTheDocument();
    expect(within(tabla).getByText('$0.005')).toBeInTheDocument();
  });

  it('cargando, vacíos y rango inválido muestran lo suyo', () => {
    renderizar();
    expect(within(bloque('cargando')).getByRole('status')).toHaveTextContent(
      'Cargando la bitácora',
    );
    expect(
      within(bloque('vacio')).getByText('Aún no hay eventos en la bitácora.'),
    ).toBeInTheDocument();
    expect(
      within(bloque('vacio_filtros')).getByRole('button', {
        name: 'Restablecer filtros',
      }),
    ).toBeInTheDocument();
    const rango = bloque('rango_invalido');
    expect(within(rango).getByLabelText('Hasta')).toHaveAccessibleDescription(
      '«Desde» no puede ser posterior a «Hasta».',
    );
    expect(within(rango).queryByRole('table')).toBeNull();
  });

  it('los tres errores usan su copy fijo', () => {
    renderizar();
    expect(
      within(bloque('error_conexion')).getByRole('alert'),
    ).toHaveTextContent('No se pudo conectar con el servidor.');
    const permiso = within(bloque('error_permiso')).getByRole('alert');
    expect(permiso).toHaveTextContent('No tienes permiso para esta acción.');
    expect(within(permiso).queryByRole('button')).toBeNull();
    expect(within(bloque('error_otro')).getByRole('alert')).toHaveTextContent(
      'No se pudo completar la solicitud.',
    );
    expect(
      within(bloque('usuarios_error')).getByLabelText('Usuario'),
    ).toHaveAccessibleDescription('No se pudo cargar la lista de usuarios.');
  });

  it('se alimenta con datos estáticos: no importa la API, la sesión ni los hooks', () => {
    expect(seccionBitacoraFuente).not.toMatch(/from\s+['"]@\/shared\/api/);
    expect(seccionBitacoraFuente).not.toMatch(/from\s+['"]@\/shared\/sesion/);
    expect(seccionBitacoraFuente).not.toMatch(
      /from\s+['"]@\/features\/bitacora\/use/,
    );
  });
});
