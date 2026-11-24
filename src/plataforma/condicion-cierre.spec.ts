import {
  evaluarCondicionCierre,
  type ConteosCondicion,
} from './condicion-cierre';

/**
 * Historia 9.5 (FR-37, SM-C1, AD-10). La condición del PRD para considerar el
 * cierre automático, evaluada sobre conteos. Solo informa: nada la guarda ni
 * la activa. Sin flotante: se compara con enteros.
 */

const SIN_DATOS: ConteosCondicion = {
  propuestas: 0,
  empresas: 0,
  meses: 0,
  tratadas: 0,
  desacuerdos: 0,
  verificados: 0,
  desacuerdosMuestra: 0,
};

const CUMPLIDA: ConteosCondicion = {
  propuestas: 1240,
  empresas: 4,
  meses: 4,
  tratadas: 940,
  desacuerdos: 3,
  verificados: 250,
  desacuerdosMuestra: 1,
};

describe('evaluarCondicionCierre (9.5)', () => {
  it('se cumple cuando los tres umbrales y la tasa más alta están dentro', () => {
    const r = evaluarCondicionCierre(CUMPLIDA);

    expect(r.cumple).toBe(true);
    expect(r.criterios.propuestas).toEqual({
      pide: 1000,
      hoy: 1240,
      falta: 0,
      cumple: true,
    });
    expect(r.tasa.registradas).toEqual({
      casos: 940,
      desacuerdos: 3,
      tasa: '0.0032',
    });
    expect(r.tasa.muestra).toEqual({
      casos: 250,
      desacuerdos: 1,
      tasa: '0.0040',
    });
    expect(r.tasa.usada).toBe('muestra');
    expect(r.tasa.tasaUsada).toBe('0.0040');
    expect(r.tasa.exceso).toBe('0.0000');
    expect(r.tasa.cumple).toBe(true);
  });

  it('dice cuántas faltan para cada umbral y cuánto sobra la tasa', () => {
    const r = evaluarCondicionCierre({
      propuestas: 350,
      empresas: 3,
      meses: 2,
      tratadas: 283,
      desacuerdos: 14,
      verificados: 40,
      desacuerdosMuestra: 1,
    });

    expect(r.cumple).toBe(false);
    expect(r.criterios.propuestas).toMatchObject({ falta: 650, cumple: false });
    expect(r.criterios.empresas).toMatchObject({ falta: 0, cumple: true });
    expect(r.criterios.meses).toMatchObject({ falta: 1, cumple: false });
    expect(r.tasa.registradas.tasa).toBe('0.0495');
    expect(r.tasa.muestra.tasa).toBe('0.0250');
    expect(r.tasa.usada).toBe('registradas');
    expect(r.tasa.exceso).toBe('0.0445');
    expect(r.tasa.cumple).toBe(false);
  });

  it('el umbral es inclusivo: 1,000 propuestas cumple y 999 faltan 1', () => {
    expect(
      evaluarCondicionCierre({ ...CUMPLIDA, propuestas: 1000 }).criterios
        .propuestas,
    ).toMatchObject({ falta: 0, cumple: true });
    expect(
      evaluarCondicionCierre({ ...CUMPLIDA, propuestas: 999 }).criterios
        .propuestas,
    ).toMatchObject({ falta: 1, cumple: false });
  });

  it('la tasa es <= 0.5 %: 5 de 1,000 cumple y 6 de 1,000 no', () => {
    const en = evaluarCondicionCierre({
      ...CUMPLIDA,
      tratadas: 1000,
      desacuerdos: 5,
      verificados: 1000,
      desacuerdosMuestra: 5,
    });
    const sobre = evaluarCondicionCierre({
      ...CUMPLIDA,
      tratadas: 1000,
      desacuerdos: 6,
      verificados: 1000,
      desacuerdosMuestra: 0,
    });

    expect(en.tasa.cumple).toBe(true);
    expect(en.tasa.tasaUsada).toBe('0.0050');
    expect(sobre.tasa.cumple).toBe(false);
    expect(sobre.tasa.exceso).toBe('0.0010');
    expect(sobre.cumple).toBe(false);
  });

  it('usa la más alta aunque la otra sea mejor: la muestra no tapa a las respuestas', () => {
    const r = evaluarCondicionCierre({
      ...CUMPLIDA,
      tratadas: 100,
      desacuerdos: 10,
      verificados: 1000,
      desacuerdosMuestra: 0,
    });

    expect(r.tasa.usada).toBe('registradas');
    expect(r.tasa.cumple).toBe(false);
    expect(r.cumple).toBe(false);
  });

  it('con una tasa exactamente igual en las dos usa la de las respuestas registradas', () => {
    const r = evaluarCondicionCierre({
      ...CUMPLIDA,
      tratadas: 200,
      desacuerdos: 1,
      verificados: 400,
      desacuerdosMuestra: 2,
    });

    expect(r.tasa.usada).toBe('registradas');
  });

  it('sin datos no se cumple nada y las tasas son null, no cero', () => {
    const r = evaluarCondicionCierre(SIN_DATOS);

    expect(r.cumple).toBe(false);
    expect(r.criterios.propuestas).toMatchObject({
      falta: 1000,
      cumple: false,
    });
    expect(r.criterios.empresas).toMatchObject({ falta: 3, cumple: false });
    expect(r.criterios.meses).toMatchObject({ falta: 3, cumple: false });
    expect(r.tasa.registradas.tasa).toBeNull();
    expect(r.tasa.muestra.tasa).toBeNull();
    expect(r.tasa.usada).toBeNull();
    expect(r.tasa.tasaUsada).toBeNull();
    expect(r.tasa.exceso).toBeNull();
    expect(r.tasa.cumple).toBe(false);
  });

  it('si falta una de las dos medidas la tasa no se cumple, aunque lo demás sí', () => {
    const sinMuestra = evaluarCondicionCierre({
      ...CUMPLIDA,
      verificados: 0,
      desacuerdosMuestra: 0,
    });
    const sinTratadas = evaluarCondicionCierre({
      ...CUMPLIDA,
      tratadas: 0,
      desacuerdos: 0,
    });

    expect(sinMuestra.tasa.muestra.tasa).toBeNull();
    expect(sinMuestra.tasa.usada).toBe('registradas');
    expect(sinMuestra.tasa.cumple).toBe(false);
    expect(sinMuestra.cumple).toBe(false);
    expect(sinTratadas.tasa.usada).toBe('muestra');
    expect(sinTratadas.tasa.cumple).toBe(false);
    expect(sinTratadas.cumple).toBe(false);
  });

  it('falta nunca es negativa: 2,000 propuestas no «sobran» propuestas', () => {
    const r = evaluarCondicionCierre({ ...CUMPLIDA, propuestas: 2000 });

    expect(r.criterios.propuestas.falta).toBe(0);
  });
});
