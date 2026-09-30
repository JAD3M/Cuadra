import type {
  CandidatoEntrada,
  EntradaSugerencia,
} from './proveedor-sugerencia';
import {
  decidirSimulado,
  ETIQUETA_SIMULADA,
  MODELO_SIMULADO,
  ProveedorSimulado,
} from './proveedor-simulado';

function cand(etiqueta: string, serieFolio: string, total: string) {
  return {
    etiqueta,
    serieFolio,
    total,
    fecha: '2026-08-12',
    receptor: '',
  } satisfies CandidatoEntrada;
}

function entrada(
  descripcion: string,
  monto: string,
  candidatos: CandidatoEntrada[],
  referencia: string | null = null,
): EntradaSugerencia {
  return {
    movimiento: {
      fecha: '2026-08-20',
      monto,
      moneda: 'MXN',
      descripcion,
      referencia,
    },
    candidatos,
  };
}

describe('ProveedorSimulado (CU-18)', () => {
  it('es activo y declara el modelo simulado', () => {
    const p = new ProveedorSimulado();
    expect(p.activo).toBe(true);
    expect(p.modelo).toBe(MODELO_SIMULADO);
    expect(MODELO_SIMULADO).toBe('simulado-demo');
  });

  it('es determinista: la misma entrada da la misma respuesta', async () => {
    const e = entrada('PAGO FACT B-2001 CLIENTE GAMA', '2320.00', [
      cand('C1', 'A-2001', '2320.00'),
      cand('C2', 'B-2001', '2320.00'),
    ]);
    const p = new ProveedorSimulado();
    expect(await p.sugerir(e)).toEqual(await p.sugerir(e));
  });

  it('cita un candidato y el monto coincide: alta, con etiqueta', () => {
    const r = decidirSimulado(
      entrada('SPEI RECIBIDO PAGO FACT B-2001 CLIENTE GAMA', '2320.00', [
        cand('C1', 'A-2001', '2320.00'),
        cand('C2', 'B-2001', '2320.00'),
      ]),
    );
    expect(r).toMatchObject({
      decision: 'sugerir',
      candidato: 'C2',
      confianza: 'alta',
    });
    expect(r.decision === 'sugerir' && r.explicacion).toMatch(
      new RegExp(`^${ETIQUETA_SIMULADA.replace(/[[\]]/g, '\\$&')}`),
    );
  });

  it('cita un candidato con monto distinto: media', () => {
    const r = decidirSimulado(
      entrada('PAGO FACT A-3001', '4000.00', [
        cand('C1', 'A-3001', '4060.00'),
        cand('C2', 'A-3002', '4060.00'),
      ]),
    );
    expect(r).toMatchObject({
      decision: 'sugerir',
      candidato: 'C1',
      confianza: 'media',
    });
  });

  it('acepta la cita sin guion ni serie separada (A3001, A 3001)', () => {
    for (const d of ['PAGO A3001 CLIENTE', 'PAGO A 3001 CLIENTE']) {
      const r = decidirSimulado(
        entrada(d, '10.00', [
          cand('C1', 'A-3001', '10.00'),
          cand('C2', 'A-3002', '10.00'),
        ]),
      );
      expect(r).toMatchObject({ decision: 'sugerir', candidato: 'C1' });
    }
  });

  it('sin cita, el monto distingue a un solo candidato entre varios: media', () => {
    const r = decidirSimulado(
      entrada('TRANSFERENCIA RECIBIDA CLIENTE GAMA', '1740.00', [
        cand('C1', 'A-2002', '1740.00'),
        cand('C2', 'B-2002', '3480.00'),
      ]),
    );
    expect(r).toMatchObject({
      decision: 'sugerir',
      candidato: 'C1',
      confianza: 'media',
    });
    expect(r.decision === 'sugerir' && r.explicacion).toContain(
      ETIQUETA_SIMULADA,
    );
  });

  it('dos citados: ninguno', () => {
    expect(
      decidirSimulado(
        entrada('FACT A-1 Y A-2', '10.00', [
          cand('C1', 'A-1', '10.00'),
          cand('C2', 'A-2', '10.00'),
        ]),
      ),
    ).toEqual({ decision: 'ninguno' });
  });

  it('montos empatados y sin cita: ninguno', () => {
    expect(
      decidirSimulado(
        entrada('DEPOSITO VENTANILLA CLIENTE GAMA', '2088.00', [
          cand('C1', 'A-2003', '2088.00'),
          cand('C2', 'B-2003', '2088.00'),
        ]),
      ),
    ).toEqual({ decision: 'ninguno' });
  });

  it('un solo candidato sin cita: ninguno (no adivina entre movimientos iguales)', () => {
    expect(
      decidirSimulado(
        entrada('DEPOSITO EN EFECTIVO SUC CENTRO', '6960.00', [
          cand('C1', 'A-3101', '6960.00'),
        ]),
      ),
    ).toEqual({ decision: 'ninguno' });
  });

  it('una referencia "2001" pegada a "GAMA" no cita A2001', () => {
    const r = decidirSimulado(
      entrada(
        'CLIENTE GAMA2001',
        '50.00',
        [cand('C1', 'A-2001', '10.00'), cand('C2', 'B-2001', '20.00')],
        '2001',
      ),
    );
    expect(r).toEqual({ decision: 'ninguno' });
  });

  it('solo mira la descripcion: citar en la referencia no cuenta', () => {
    const r = decidirSimulado(
      entrada(
        'PAGO CLIENTE',
        '50.00',
        [cand('C1', 'A-2001', '10.00'), cand('C2', 'B-2001', '20.00')],
        'A-2001',
      ),
    );
    expect(r).toEqual({ decision: 'ninguno' });
  });

  it('nunca devuelve una etiqueta que no recibió', () => {
    const e = entrada('PAGO FACT A-1', '10.00', [
      cand('C1', 'A-1', '10.00'),
      cand('C2', 'A-2', '10.00'),
    ]);
    const r = decidirSimulado(e);
    expect(r.decision).toBe('sugerir');
    if (r.decision === 'sugerir') {
      expect(e.candidatos.map((c) => c.etiqueta)).toContain(r.candidato);
    }
  });

  it('no usa la red', async () => {
    const espia = jest.spyOn(globalThis, 'fetch');
    await new ProveedorSimulado().sugerir(
      entrada('PAGO FACT A-1', '10.00', [
        cand('C1', 'A-1', '10.00'),
        cand('C2', 'A-2', '10.00'),
      ]),
    );
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('la explicación cabe en el motivo persistido (< 500)', () => {
    const r = decidirSimulado(
      entrada('PAGO FACT A-1', '10.00', [
        cand('C1', 'A-1', '10.00'),
        cand('C2', 'A-2', '10.00'),
      ]),
    );
    expect(r.decision === 'sugerir' && r.explicacion.length).toBeLessThan(500);
  });
});
