// src/bancos/huella-movimiento.spec.ts
import {
  HUELLA_VERSION,
  huellaMovimiento,
  mismaReferenciaCruda,
  type EntradaHuella,
} from './huella-movimiento';

const base: EntradaHuella = {
  cuenta: '0123 4567-89',
  fecha: '2026-09-02',
  monto: '250.0000',
  referencia: 'FAC-0012',
};

describe('huellaMovimiento', () => {
  it('lleva la versión como prefijo y un sha256 en hex', () => {
    const h = huellaMovimiento(base);
    expect(h).toMatch(new RegExp(`^${HUELLA_VERSION}:[0-9a-f]{64}$`));
    expect(h.length).toBeLessThanOrEqual(70);
  });

  it('es estable: misma entrada, misma huella', () => {
    expect(huellaMovimiento({ ...base })).toBe(huellaMovimiento({ ...base }));
  });

  it.each(['250', '250.0', '250.00', '250.0000', '250.00000'])(
    'el monto %s equivale a 250.0000',
    (monto) => {
      expect(huellaMovimiento({ ...base, monto })).toBe(huellaMovimiento(base));
    },
  );

  it('distingue signo y centavos del monto', () => {
    const h = huellaMovimiento(base);
    expect(huellaMovimiento({ ...base, monto: '-250' })).not.toBe(h);
    expect(huellaMovimiento({ ...base, monto: '250.0001' })).not.toBe(h);
  });

  it('el cero negativo y el cero coinciden', () => {
    expect(huellaMovimiento({ ...base, monto: '-0' })).toBe(
      huellaMovimiento({ ...base, monto: '0.0000' }),
    );
  });

  it('la cuenta se normaliza: espacios, símbolos y mayúsculas no cuentan', () => {
    const h = huellaMovimiento({ ...base, cuenta: 'ab-12 34' });
    expect(huellaMovimiento({ ...base, cuenta: ' AB1234 ' })).toBe(h);
    expect(huellaMovimiento({ ...base, cuenta: 'ab/12.34' })).toBe(h);
    expect(huellaMovimiento({ ...base, cuenta: 'AB1235' })).not.toBe(h);
  });

  it('cuenta nula, vacía o solo símbolos dan la misma huella', () => {
    const h = huellaMovimiento({ ...base, cuenta: null });
    expect(huellaMovimiento({ ...base, cuenta: '' })).toBe(h);
    expect(huellaMovimiento({ ...base, cuenta: ' -/ ' })).toBe(h);
    expect(huellaMovimiento(base)).not.toBe(h);
  });

  it('la referencia se normaliza: ceros, símbolos y mayúsculas no cuentan', () => {
    const h = huellaMovimiento(base);
    expect(huellaMovimiento({ ...base, referencia: 'fac 12' })).toBe(h);
    expect(huellaMovimiento({ ...base, referencia: 'FAC-13' })).not.toBe(h);
  });

  it('referencia nula, vacía o solo símbolos dan la misma huella', () => {
    const h = huellaMovimiento({ ...base, referencia: null });
    expect(huellaMovimiento({ ...base, referencia: '' })).toBe(h);
    expect(huellaMovimiento({ ...base, referencia: '-/.' })).toBe(h);
  });

  it('distingue la fecha', () => {
    expect(huellaMovimiento({ ...base, fecha: '2026-09-03' })).not.toBe(
      huellaMovimiento(base),
    );
  });

  it('rechaza una fecha que no sea YYYY-MM-DD y un monto no decimal', () => {
    expect(() => huellaMovimiento({ ...base, fecha: '02/09/2026' })).toThrow();
    expect(() => huellaMovimiento({ ...base, fecha: '2026-9-2' })).toThrow();
    expect(() => huellaMovimiento({ ...base, monto: '1e3' })).toThrow();
  });

  it('mover un carácter entre campos vecinos no produce la misma huella', () => {
    const a = huellaMovimiento({
      cuenta: 'AB1',
      fecha: '2026-09-02',
      monto: '1',
      referencia: 'C2',
    });
    const b = huellaMovimiento({
      cuenta: 'AB',
      fecha: '2026-09-02',
      monto: '1',
      referencia: '1C2',
    });
    expect(a).not.toBe(b);
    const c = huellaMovimiento({ ...base, cuenta: null, referencia: 'X' });
    const d = huellaMovimiento({ ...base, cuenta: 'X', referencia: null });
    expect(c).not.toBe(d);
  });
});

describe('mismaReferenciaCruda', () => {
  it('compara tras recortar espacios, sin otra normalización', () => {
    expect(mismaReferenciaCruda(' FAC-12 ', 'FAC-12')).toBe(true);
    expect(mismaReferenciaCruda('FAC-12', 'FAC 12')).toBe(false);
    expect(mismaReferenciaCruda('fac-12', 'FAC-12')).toBe(false);
    expect(mismaReferenciaCruda('FAC-0012', 'FAC-12')).toBe(false);
  });

  it('nulo y vacío son iguales', () => {
    expect(mismaReferenciaCruda(null, '')).toBe(true);
    expect(mismaReferenciaCruda(null, '   ')).toBe(true);
    expect(mismaReferenciaCruda(undefined, null)).toBe(true);
    expect(mismaReferenciaCruda(null, 'A')).toBe(false);
  });
});
