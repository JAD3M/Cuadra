import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanelCarga, type PanelCargaProps } from './PanelCarga';

const BASE: PanelCargaProps = {
  vista: 'por_archivo',
  frasesYaExistia: null,
  conteo: { ok: 1, existentes: 1, error: 1 },
  resultados: [
    { archivo: 'a.xml', resultado: 'nuevo' },
    { archivo: 'b.xml', resultado: 'ya_existia' },
    { archivo: 'c.xml', resultado: 'error', motivo: 'XML mal formado' },
  ],
};

describe('PanelCarga', () => {
  it('por archivo: el resumen de CFDI y una entrada por archivo', () => {
    render(<PanelCarga {...BASE} />);
    expect(screen.getByRole('region', { name: 'Resultado por archivo' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('XML mal formado')).toBeInTheDocument();
  });

  it('por fila: el resumen de registros y las filas con error, sin las archivo', () => {
    render(
      <PanelCarga
        {...BASE}
        vista="por_fila"
        conteo={{ ok: 98, existentes: 0, error: 2 }}
        resultados={[
          { fila: 4, resultado: 'error', motivo: 'Monto inválido' },
          { fila: 17, resultado: 'error', motivo: 'Fecha vacía' },
        ]}
      />,
    );
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent === '98 registros cargados, 2 con error.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('en curso: solo el estado de proceso, sin resumen ni lista', () => {
    render(<PanelCarga {...BASE} vista="en_curso" resultados={[]} />);
    expect(screen.getByText('Procesando la carga…')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('sin proceso: solo el aviso de falla, sin etiqueta, mensaje ni lista', () => {
    const { container } = render(
      <PanelCarga {...BASE} vista="sin_proceso" resultados={[]} />,
    );
    expect(
      screen.getByText(
        'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Fallida')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(container.textContent).not.toContain('Falló el worker');
  });

  it('solo aviso: el aviso de K7 sin resumen ni lista de resultados', () => {
    const { container } = render(
      <PanelCarga
        {...BASE}
        vista="solo_aviso"
        frasesYaExistia={[
          'Este archivo ya se había cargado.',
          'No se duplicó nada.',
        ]}
      />,
    );
    expect(screen.getByText('No se duplicó nada.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(container.textContent).not.toMatch(/nuevos|con error/);
  });

  it('con yaExistia muestra el aviso antes del contenido', () => {
    const { container } = render(
      <PanelCarga
        {...BASE}
        frasesYaExistia={[
          'Este archivo ya se había cargado.',
          'No se duplicó nada.',
        ]}
      />,
    );
    const aviso = screen.getByText('No se duplicó nada.');
    const lista = screen.getByRole('region', { name: 'Resultado por archivo' });
    expect(
      aviso.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelectorAll('[role=status]')).toHaveLength(0);
  });

  it('el aviso de yaExistia convive con el estado en curso', () => {
    render(
      <PanelCarga
        {...BASE}
        vista="en_curso"
        resultados={[]}
        frasesYaExistia={[
          'Este archivo ya se había cargado y se volvió a poner en la cola.',
        ]}
      />,
    );
    expect(
      screen.getByText(
        'Este archivo ya se había cargado y se volvió a poner en la cola.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Procesando la carga…')).toBeInTheDocument();
  });

  it('un CFDI ignora las entradas por fila y un CSV las de archivo', () => {
    render(
      <PanelCarga
        {...BASE}
        resultados={[
          { archivo: 'a.xml', resultado: 'nuevo' },
          { fila: 4, resultado: 'error', motivo: 'ruido' },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('ruido')).toBeNull();
  });
  it('en curso con el tope vencido: el aviso con Actualizar reemplaza la barra de proceso (mockup resultado_sin_actualizar)', async () => {
    const alActualizar = vi.fn();
    render(
      <PanelCarga
        {...BASE}
        vista="en_curso"
        resultados={[]}
        alActualizar={alActualizar}
      />,
    );
    expect(
      screen.getByText('La lista dejó de actualizarse.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Procesando la carga…')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(alActualizar).toHaveBeenCalledTimes(1);
  });

  it('con el tope vencido pero ya terminada: el resultado manda, sin aviso ni botón', () => {
    render(<PanelCarga {...BASE} alActualizar={() => undefined} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
  });

  it('en curso sin tope vencido: nunca hay botón Actualizar (K5)', () => {
    render(<PanelCarga {...BASE} vista="en_curso" resultados={[]} />);
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
  });
});
