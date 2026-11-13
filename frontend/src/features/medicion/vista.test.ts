import { describe, expect, it } from 'vitest';
import { vistaMedicion } from './vista';

const datos = (
  o: Partial<{
    propuestas: number;
    tratadas: number;
    desacuerdos: number;
    tasa: string | null;
  }>,
) => ({
  propuestas: 240,
  tratadas: 200,
  desacuerdos: 8,
  tasa: '0.0400',
  ...o,
});

describe('vistaMedicion (historia 9.1)', () => {
  it('cargando mientras no hay datos ni error', () => {
    expect(
      vistaMedicion({ cargando: true, error: false, datos: undefined }),
    ).toEqual({
      tipo: 'cargando',
    });
  });

  it('error si la lectura falló, aunque haya datos viejos', () => {
    expect(
      vistaMedicion({ cargando: false, error: true, datos: undefined }),
    ).toEqual({
      tipo: 'error',
    });
  });

  it('sin propuestas: «sin datos», nunca una tasa en cero', () => {
    expect(
      vistaMedicion({
        cargando: false,
        error: false,
        datos: datos({
          propuestas: 0,
          tratadas: 0,
          desacuerdos: 0,
          tasa: null,
        }),
      }),
    ).toEqual({ tipo: 'sin_datos' });
  });

  it('con propuestas pero ninguna tratada: «sin tratadas» con el total', () => {
    expect(
      vistaMedicion({
        cargando: false,
        error: false,
        datos: datos({
          propuestas: 12,
          tratadas: 0,
          desacuerdos: 0,
          tasa: null,
        }),
      }),
    ).toEqual({ tipo: 'sin_tratadas', propuestas: 12 });
  });

  it('con tratadas: la tasa en porcentaje y las tres cifras', () => {
    expect(
      vistaMedicion({ cargando: false, error: false, datos: datos({}) }),
    ).toEqual({
      tipo: 'listo',
      tasa: '4.00 %',
      propuestas: 240,
      tratadas: 200,
      desacuerdos: 8,
    });
  });

  it('una tasa en cero con tratadas sí es un cero real: 0.00 %', () => {
    const v = vistaMedicion({
      cargando: false,
      error: false,
      datos: datos({ desacuerdos: 0, tasa: '0.0000' }),
    });
    expect(v).toMatchObject({ tipo: 'listo', tasa: '0.00 %' });
  });
});
