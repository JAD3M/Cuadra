import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { eventoBitacora, type EventoBitacora } from '@/shared/api/contratos';
import { ACCIONES_BITACORA } from '@/shared/dominio';
import { EVENTOS_MAQUETA, eventoDeBitacora } from '@/test/fixturesBitacora';
import { TONOS_ACCION } from '@/features/bitacora/tonos';
import { TablaBitacora } from './TablaBitacora';

const ZONA = 'America/Mexico_City';

/** Los eventos como los entrega el contrato (sin ip, userAgent ni correo). */
const validar = (crudos: readonly unknown[]): EventoBitacora[] =>
  crudos.map((e) => eventoBitacora.parse(e));

const MAQUETA = validar(EVENTOS_MAQUETA);

function montar(eventos: readonly EventoBitacora[] = MAQUETA) {
  return render(<TablaBitacora eventos={eventos} zona={ZONA} />);
}

function filas(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

const celdas = (fila: HTMLElement) =>
  within(fila)
    .getAllByRole('cell')
    .map((c) => c.textContent);

describe('TablaBitacora: estructura', () => {
  it('publica las columnas de la maqueta en orden, con scope=col', () => {
    montar();
    const encabezados = screen.getAllByRole('columnheader');
    expect(encabezados.map((e) => e.textContent)).toEqual([
      'Cuándo',
      'Usuario',
      'Acción',
      'Entidad',
      'Detalle',
    ]);
    for (const e of encabezados) expect(e).toHaveAttribute('scope', 'col');
  });

  it('es una región con nombre, sin controles de orden', () => {
    montar();
    expect(screen.getByRole('region')).toHaveAccessibleName(
      'Eventos de la bitácora',
    );
    for (const e of screen.getAllByRole('columnheader')) {
      expect(within(e).queryByRole('button')).toBeNull();
      expect(e).not.toHaveAttribute('aria-sort');
    }
  });

  it('pinta las siete filas de la maqueta, en el orden del servidor', () => {
    montar();
    expect(filas().map(celdas)).toEqual([
      [
        '2026-09-18 16:02',
        'Luis Reyes',
        'confirmar',
        'conciliaciones0192a3f4-8c1e-7b2d-9f10-3e5c41a2d7b8',
        'propuesta → confirmada · diferencia $0.00',
      ],
      [
        '2026-09-18 15:47',
        'Jorge Tapia',
        'acceso_denegado',
        'companies0191f2c0-51c0-7a3f-8e44-a3f4b27d9e10',
        'PUT /empresa/tolerancia · rol insuficiente: requiere admin, tiene revisor',
      ],
      [
        '2026-09-18 12:30',
        'Luis Reyes',
        'rechazar',
        'conciliaciones0192a3f4-3f9a-7c11-8d02-0c77e04b77d1',
        'propuesta → rechazada · motivo: el CFDI corresponde a otra obra',
      ],
      [
        '2026-09-18 09:15',
        'Sistema',
        'crear',
        'conciliaciones0192a3f4-b27d-7e10-9a3c-51c0a3f48c1e',
        'propuesta · origen regla · diferencia $0.50',
      ],
      [
        '2026-09-17 18:20',
        'Sistema',
        'crear',
        'conciliaciones0192a3f4-77d1-7a01-8b55-3f9a0c7712ab',
        'propuesta · origen llm',
      ],
      [
        '2026-09-02 11:40',
        'Ana Mendoza',
        'actualizar',
        'companies0191f2c0-51c0-7a3f-8e44-a3f4b27d9e10',
        'tolerancia_monto: $0.005 → $0.50',
      ],
      [
        '2026-09-01 10:05',
        'Ana Mendoza',
        'rechazar',
        'conciliaciones0192a3f4-e04b-7d77-9c20-41a28c1e3f9a',
        '—',
      ],
    ]);
  });

  it('sin eventos deja el encabezado y ninguna fila de datos', () => {
    montar([]);
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});

describe('TablaBitacora: cuándo', () => {
  it('publica el instante exacto en <time> y la hora en la zona dada', () => {
    montar();
    const tiempo = filas()[0]?.querySelector('time');
    expect(tiempo).toHaveAttribute('datetime', '2026-09-18T22:02:00.000Z');
    expect(tiempo).toHaveTextContent('2026-09-18 16:02');
  });

  it('otra zona cambia la hora mostrada, no el instante', () => {
    render(<TablaBitacora eventos={MAQUETA.slice(0, 1)} zona="UTC" />);
    expect(screen.getByText('2026-09-18 22:02')).toBeInTheDocument();
  });
});

describe('TablaBitacora: usuario', () => {
  it('un evento sin usuario es «Sistema», atenuado', () => {
    montar();
    const sistema = within(filas()[3] as HTMLElement).getByText('Sistema');
    expect(sistema.className).toMatch(/sistema/);
    const persona = within(filas()[0] as HTMLElement).getByText('Luis Reyes');
    expect(persona.className).toMatch(/quien/);
  });
});

describe('TablaBitacora: chips de acción', () => {
  it('cada acción usa su tono y muestra su nombre', () => {
    const eventos = validar(
      ACCIONES_BITACORA.map((accion, i) => eventoDeBitacora(i + 1, { accion })),
    );
    montar(eventos);
    for (const accion of ACCIONES_BITACORA) {
      const chip = screen.getByText(accion, { selector: 'span' });
      expect(chip).toHaveAttribute('data-tono', TONOS_ACCION[accion]);
    }
  });

  it('el mapa de tonos sigue la maqueta', () => {
    expect(TONOS_ACCION).toEqual({
      crear: 'neutral',
      actualizar: 'ia',
      eliminar: 'neutral',
      cargar: 'sugerencia',
      confirmar: 'conciliado',
      rechazar: 'sin_match',
      acceso_denegado: 'denegado',
      invitar: 'neutral',
      reenviar_invitacion: 'neutral',
      cancelar_invitacion: 'neutral',
    });
  });
});

describe('TablaBitacora: fila de acceso denegado', () => {
  it('solo la fila del acceso denegado lleva el fondo de peligro', () => {
    montar();
    const marcadas = filas().filter((f) => /filaDenegada/.test(f.className));
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toHaveAttribute('data-accion', 'acceso_denegado');
  });
});

describe('TablaBitacora: detalle', () => {
  it('cada monto va en su propio elemento, sin partirse', () => {
    montar();
    const detalle = within(filas()[5] as HTMLElement).getAllByRole('cell')[4];
    const montos = [...(detalle?.querySelectorAll('span') ?? [])];
    expect(montos.map((m) => m.textContent)).toEqual(['$0.005', '$0.50']);
    for (const m of montos) expect(m.className).toMatch(/monto/);
  });

  it('un monto negativo queda entero, con el signo antes del símbolo', () => {
    montar(
      validar([
        eventoDeBitacora(1, {
          datos: {
            antes: { estado: 'propuesta' },
            despues: { estado: 'confirmada' },
            diferenciaMonto: '-60.0000',
          },
        }),
      ]),
    );
    expect(screen.getByText('-$60.00')).toHaveClass(/monto/);
  });

  it('un motivo con HTML se pinta como texto, nunca como marcado', () => {
    const motivo = '<img src=x onerror=alert(1)>';
    const { container } = montar(
      validar([
        eventoDeBitacora(1, {
          accion: 'rechazar',
          datos: {
            antes: { estado: 'propuesta' },
            despues: { estado: 'rechazada', motivo },
          },
        }),
      ]),
    );
    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByText(`propuesta → rechazada · motivo: ${motivo}`),
    ).toBeInTheDocument();
  });

  it('datos nulos dan «—» sin romper la tabla', () => {
    montar(validar([eventoDeBitacora(1, { datos: null })]));
    expect(celdas(filas()[0] as HTMLElement)[4]).toBe('—');
  });
});

describe('TablaBitacora: carga', () => {
  it('con cargando anuncia el estado y no pinta tabla', () => {
    render(<TablaBitacora eventos={MAQUETA} cargando />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando la bitácora',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });
});
