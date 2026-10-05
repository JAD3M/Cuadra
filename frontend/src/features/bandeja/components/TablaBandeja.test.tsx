import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ESTADOS_BANDEJA } from '@/shared/dominio/bandeja';
import {
  conPropuesta,
  filaBandeja,
  idDe,
  MOTIVO_IA_REAL,
  MOTIVO_IA_SIMULADA,
} from '@/test/fixturesBandeja';
import type { FilaBandeja } from '@/shared/api/contratos';
import { TablaBandeja } from './TablaBandeja';

function montar(filas: FilaBandeja[], cargando = false) {
  return render(
    <MemoryRouter>
      <TablaBandeja filas={filas} cargando={cargando} />
    </MemoryRouter>,
  );
}

function filaDe(texto: string): HTMLElement {
  const fila = screen.getByText(texto).closest('tr');
  if (fila === null) throw new Error(`Sin fila para ${texto}`);
  return fila;
}

describe('TablaBandeja: estructura', () => {
  it('publica las columnas en el orden del mockup con scope=col', () => {
    montar([filaBandeja()]);
    const encabezados = screen.getAllByRole('columnheader');
    expect(encabezados.map((e) => e.textContent)).toEqual([
      'Fecha',
      'Movimiento',
      'Monto',
      'Estado',
      'Regla / motivo',
      'CFDI candidato',
      'Diferencia',
    ]);
    for (const e of encabezados) expect(e).toHaveAttribute('scope', 'col');
  });

  it('es una región con nombre y caption, con el orden estático y sin controles de orden', () => {
    const { container } = montar([filaBandeja()]);
    const region = screen.getByRole('region');
    expect(region).toHaveAccessibleName(/Movimientos por revisar/);
    expect(container.querySelector('caption')).toHaveTextContent(
      'Orden: monto ↓',
    );
    const encabezado = screen.getAllByRole('columnheader');
    for (const e of encabezado) {
      expect(within(e).queryByRole('button')).toBeNull();
      expect(e).not.toHaveAttribute('aria-sort');
    }
  });

  it('conserva el orden de las filas tal como llegaron', () => {
    const filas = [
      filaBandeja({
        movimientoId: idDe(1),
        descripcion: 'Tres mil',
        monto: '3000.0000',
      }),
      filaBandeja({
        movimientoId: idDe(2),
        descripcion: 'Dos mil',
        monto: '2000.0000',
      }),
      filaBandeja({
        movimientoId: idDe(3),
        descripcion: 'Cien',
        monto: '100.0000',
      }),
      filaBandeja({
        movimientoId: idDe(4),
        descripcion: 'Mil',
        monto: '1000.0000',
      }),
    ];
    montar(filas);
    const enlaces = screen.getAllByRole('link').map((l) => l.textContent);
    expect(enlaces).toEqual(['Tres mil', 'Dos mil', 'Cien', 'Mil']);
  });

  it('no ofrece confirmar, rechazar ni cerrar: solo enlaces', () => {
    montar([
      filaBandeja({ estado: 'sugerencia', mejorPropuesta: conPropuesta(1) }),
    ]);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/confirmar|rechazar|cerrar/i)).toBeNull();
  });
});

describe('TablaBandeja: enlace, referencia y fecha', () => {
  it('el enlace apunta a /casos/<id codificado> y su nombre es la descripción', () => {
    montar([
      filaBandeja({ movimientoId: 'a/b c?d#e', descripcion: 'SPEI Olvera' }),
    ]);
    const enlace = screen.getByRole('link', { name: 'SPEI Olvera' });
    expect(enlace).toHaveAttribute('href', '/casos/a%2Fb%20c%3Fd%23e');
  });

  it('también enlaza las filas sin_match', () => {
    montar([filaBandeja({ movimientoId: idDe(9), estado: 'sin_match' })]);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/casos/${idDe(9)}`,
    );
  });

  it('muestra "REF F-2291" o "sin referencia"', () => {
    montar([
      filaBandeja({
        movimientoId: idDe(1),
        descripcion: 'Con',
        referencia: 'F-2291',
      }),
      filaBandeja({
        movimientoId: idDe(2),
        descripcion: 'Sin',
        referencia: null,
      }),
    ]);
    expect(within(filaDe('Con')).getByText('REF F-2291')).toBeInTheDocument();
    expect(
      within(filaDe('Sin')).getByText('sin referencia'),
    ).toBeInTheDocument();
  });

  it('la fecha se muestra sin correrse un día', () => {
    montar([filaBandeja({ fecha: '2026-01-01' })]);
    expect(screen.getByText('2026-01-01')).toBeInTheDocument();
  });
});

describe('TablaBandeja: monto y estado', () => {
  it('MXN no lleva código; USD lo lleva en el mismo elemento sin partir', () => {
    montar([
      filaBandeja({
        movimientoId: idDe(1),
        descripcion: 'Peso',
        monto: '1160.0000',
        moneda: 'MXN',
      }),
      filaBandeja({
        movimientoId: idDe(2),
        descripcion: 'Dolar',
        monto: '2150.0000',
        moneda: 'USD',
      }),
    ]);
    expect(within(filaDe('Peso')).getByText('$1,160.00')).toBeInTheDocument();
    expect(within(filaDe('Peso')).queryByText(/MXN/)).toBeNull();
    const usd = within(filaDe('Dolar')).getByText('$2,150.00 USD');
    expect(usd).toHaveAttribute('data-estado', 'normal');
  });

  it('conserva la precisión con montos enormes', () => {
    montar([filaBandeja({ monto: '9007199254740993.1200' })]);
    expect(screen.getByText('$9,007,199,254,740,993.12')).toBeInTheDocument();
  });

  it.each([
    ['sugerencia', '●Sugerencia'],
    ['sin_match', '○Sin match'],
    ['conciliado', '✓Conciliado'],
  ] as const)('el estado %s lleva glifo y texto', (estado, texto) => {
    expect(ESTADOS_BANDEJA).toContain(estado);
    const { container } = montar([filaBandeja({ estado })]);
    const chip = container.querySelector(`[data-tono="${estado}"]`);
    expect(chip).toHaveTextContent(texto);
    expect(chip?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('TablaBandeja: regla, insignia, CFDI y diferencia', () => {
  it('muestra el código de la regla y nunca el texto del motivo', () => {
    montar([
      filaBandeja({
        regla: 'referencia_monto_exacto',
        motivo: 'Motivo larguísimo del motor',
      }),
    ]);
    expect(screen.getByText('referencia_monto_exacto')).toBeInTheDocument();
    expect(screen.queryByText(/Motivo larguísimo/)).toBeNull();
  });

  it('una regla desconocida se muestra tal cual', () => {
    montar([filaBandeja({ regla: 'regla_del_futuro' })]);
    expect(screen.getByText('regla_del_futuro')).toBeInTheDocument();
  });

  it('las filas llm llevan insignia: simulada solo con el prefijo completo', () => {
    montar([
      filaBandeja({
        movimientoId: idDe(1),
        descripcion: 'Simulada',
        regla: 'llm_sugerencia',
        motivo: MOTIVO_IA_SIMULADA,
      }),
      filaBandeja({
        movimientoId: idDe(2),
        descripcion: 'Real',
        regla: 'llm_sugerencia',
        motivo: MOTIVO_IA_REAL,
      }),
      filaBandeja({
        movimientoId: idDe(3),
        descripcion: 'Motor',
        regla: 'monto_unico',
        motivo: MOTIVO_IA_SIMULADA,
      }),
    ]);
    expect(
      within(filaDe('Simulada')).getByText('IA · simulada'),
    ).toBeInTheDocument();
    expect(within(filaDe('Real')).getByText('IA')).toBeInTheDocument();
    expect(within(filaDe('Real')).queryByText(/simulada/)).toBeNull();
    expect(within(filaDe('Motor')).queryByText(/IA/)).toBeNull();
  });

  it('muestra serie-folio, o el UUID corto, y la diferencia de la propuesta', () => {
    montar([
      filaBandeja({
        movimientoId: idDe(1),
        descripcion: 'Con folio',
        estado: 'sugerencia',
        mejorPropuesta: conPropuesta(1, {
          serie: 'A',
          folio: '1042',
          diferenciaMonto: '0.4000',
        }),
      }),
      filaBandeja({
        movimientoId: idDe(2),
        descripcion: 'Sin folio',
        estado: 'sugerencia',
        mejorPropuesta: conPropuesta(2, { serie: null, folio: null }),
      }),
    ]);
    expect(within(filaDe('Con folio')).getByText('A-1042')).toBeInTheDocument();
    expect(within(filaDe('Con folio')).getByText('$0.40')).toBeInTheDocument();
    expect(
      within(filaDe('Sin folio')).getByText('A1B2C3D4'),
    ).toBeInTheDocument();
  });

  it('una diferencia menor a un centavo conserva el texto oculto', () => {
    montar([
      filaBandeja({
        estado: 'sugerencia',
        mejorPropuesta: conPropuesta(1, { diferenciaMonto: '0.0040' }),
      }),
    ]);
    expect(screen.getByText('menor a un centavo')).toBeInTheDocument();
  });

  it('sin_match muestra "—" en CFDI y en Diferencia', () => {
    montar([filaBandeja({ estado: 'sin_match', mejorPropuesta: null })]);
    const fila = screen.getByRole('link').closest('tr') as HTMLElement;
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas[5]).toHaveTextContent(/^—$/);
    expect(celdas[6]).toHaveTextContent(/^—$/);
  });
});

describe('TablaBandeja: carga', () => {
  it('muestra relleno con aria-busy y ninguna fila de datos', () => {
    montar([filaBandeja()], true);
    const relleno = screen.getByLabelText('Cargando movimientos');
    expect(relleno).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
