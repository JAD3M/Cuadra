import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ACCIONES_BITACORA, ENTIDADES_BITACORA } from '@/shared/dominio';
import { textoAccion } from '@/features/bitacora/textoAccion';
import type { FiltrosBitacora as Filtros } from '@/features/bitacora/filtrosUrl';
import {
  FiltrosBitacora,
  type EstadoUsuarios,
  type FiltrosBitacoraProps,
} from './FiltrosBitacora';

const ANA = {
  id: '11111111-2222-4333-8444-555555555551',
  nombre: 'Ana Mendoza',
};
const LUIS = {
  id: '11111111-2222-4333-8444-555555555552',
  nombre: 'Luis Reyes',
};
const LISTA: EstadoUsuarios = { tipo: 'lista', usuarios: [ANA, LUIS] };

function montar(o: Partial<FiltrosBitacoraProps> = {}) {
  const onCambiar = vi.fn();
  const props: FiltrosBitacoraProps = {
    filtros: { pagina: 1 },
    usuarios: LISTA,
    onCambiar,
    ...o,
  };
  render(<FiltrosBitacora {...props} />);
  return { onCambiar };
}

const opciones = (nombre: string) =>
  within(screen.getByRole('combobox', { name: nombre }))
    .getAllByRole('option')
    .map((o) => o.textContent);

describe('FiltrosBitacora: estructura', () => {
  it('es un formulario con nombre y los cinco campos en el orden de la maqueta', () => {
    montar();
    const form = screen.getByRole('form', { name: 'Filtros de la bitácora' });
    const etiquetas = [...form.querySelectorAll('label')].map(
      (l) => l.textContent,
    );
    expect(etiquetas).toEqual([
      'Entidad',
      'Acción',
      'Usuario',
      'Desde',
      'Hasta',
    ]);
    expect(screen.getByLabelText('Desde')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('type', 'date');
  });

  it('no ofrece enviar, editar ni borrar: no hay botones', () => {
    montar();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('entidad lista los valores de la API y acción, los de la API salvo la administración en español', () => {
    montar();
    expect(opciones('Entidad')).toEqual(['Todas', ...ENTIDADES_BITACORA]);
    expect(opciones('Acción')).toEqual([
      'Todas',
      ...ACCIONES_BITACORA.map(textoAccion),
    ]);
  });

  it('usuario lista a las personas en el orden recibido', () => {
    montar();
    expect(opciones('Usuario')).toEqual(['Todos', 'Ana Mendoza', 'Luis Reyes']);
  });

  it('refleja los filtros de la URL', () => {
    const filtros: Filtros = {
      entidad: 'companies',
      accion: 'acceso_denegado',
      usuario: LUIS.id,
      desde: '2026-09-01',
      hasta: '2026-09-30',
      pagina: 3,
    };
    montar({ filtros });
    expect(screen.getByLabelText('Entidad')).toHaveValue('companies');
    expect(screen.getByLabelText('Acción')).toHaveValue('acceso_denegado');
    expect(screen.getByLabelText('Usuario')).toHaveValue(LUIS.id);
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-09-30');
  });
});

describe('FiltrosBitacora: cambios', () => {
  it('elegir una entidad, una acción o un usuario sale por onCambiar', async () => {
    const usuario = userEvent.setup();
    const { onCambiar } = montar();
    await usuario.selectOptions(screen.getByLabelText('Entidad'), 'companies');
    await usuario.selectOptions(screen.getByLabelText('Acción'), 'rechazar');
    await usuario.selectOptions(
      screen.getByLabelText('Usuario'),
      'Ana Mendoza',
    );
    expect(onCambiar.mock.calls).toEqual([
      [{ entidad: 'companies' }],
      [{ accion: 'rechazar' }],
      [{ usuario: ANA.id }],
    ]);
  });

  it('volver a «Todas» o «Todos» quita el filtro', async () => {
    const usuario = userEvent.setup();
    const { onCambiar } = montar({
      filtros: {
        entidad: 'companies',
        accion: 'crear',
        usuario: ANA.id,
        pagina: 1,
      },
    });
    await usuario.selectOptions(screen.getByLabelText('Entidad'), 'Todas');
    await usuario.selectOptions(screen.getByLabelText('Acción'), 'Todas');
    await usuario.selectOptions(screen.getByLabelText('Usuario'), 'Todos');
    expect(onCambiar.mock.calls).toEqual([
      [{ entidad: undefined }],
      [{ accion: undefined }],
      [{ usuario: undefined }],
    ]);
  });

  it('las fechas salen como día AAAA-MM-DD y vaciarlas quita el filtro', () => {
    const { onCambiar } = montar({
      filtros: { hasta: '2026-09-30', pagina: 1 },
    });
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '' } });
    expect(onCambiar.mock.calls).toEqual([
      [{ desde: '2026-09-01' }],
      [{ hasta: undefined }],
    ]);
  });
});

describe('FiltrosBitacora: rango invertido', () => {
  it('marca «Hasta» como inválido y lo describe con el aviso', () => {
    montar({
      filtros: { desde: '2026-10-05', hasta: '2026-09-30', pagina: 1 },
    });
    const hasta = screen.getByLabelText('Hasta');
    expect(hasta).toHaveAttribute('aria-invalid', 'true');
    expect(hasta).toHaveAccessibleDescription(
      '«Desde» no puede ser posterior a «Hasta».',
    );
  });

  it('el mismo día en ambos lados es válido', () => {
    montar({
      filtros: { desde: '2026-09-30', hasta: '2026-09-30', pagina: 1 },
    });
    expect(screen.getByLabelText('Hasta')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/no puede ser posterior/)).toBeNull();
  });
});

describe('FiltrosBitacora: lista de usuarios', () => {
  it('si falló, deja solo «Todos» y avisa en la descripción del campo', () => {
    montar({ usuarios: { tipo: 'error' } });
    expect(opciones('Usuario')).toEqual(['Todos']);
    expect(screen.getByLabelText('Usuario')).toHaveAccessibleDescription(
      'No se pudo cargar la lista de usuarios.',
    );
  });

  it('mientras carga no avisa nada', () => {
    montar({ usuarios: { tipo: 'cargando' } });
    expect(opciones('Usuario')).toEqual(['Todos']);
    expect(screen.queryByText(/No se pudo cargar/)).toBeNull();
  });

  it('un usuario de la URL que la lista no trae se conserva y se ve elegido', () => {
    const ajeno = '99999999-2222-4333-8444-555555555555';
    montar({ filtros: { usuario: ajeno, pagina: 1 } });
    expect(screen.getByLabelText('Usuario')).toHaveValue(ajeno);
    expect(opciones('Usuario')).toEqual([
      'Todos',
      'Ana Mendoza',
      'Luis Reyes',
      ajeno,
    ]);
  });

  it('un nombre con HTML se muestra como texto', () => {
    const nombre = '<b>Ana</b>';
    montar({ usuarios: { tipo: 'lista', usuarios: [{ id: ANA.id, nombre }] } });
    expect(opciones('Usuario')).toContain(nombre);
  });
});
