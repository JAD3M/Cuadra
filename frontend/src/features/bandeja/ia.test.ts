import { describe, expect, it } from 'vitest';
import { insigniaIa, PREFIJO_MOTIVO_SIMULADO } from './ia';

const SIMULADO = `${PREFIJO_MOTIVO_SIMULADO} Coincide el monto.`;

describe('insigniaIa', () => {
  it('llm con el prefijo completo guardado es IA simulada', () => {
    expect(insigniaIa('llm_sugerencia', SIMULADO)).toBe('ia_simulada');
  });

  it('el prefijo literal coincide con lo que guarda el backend', () => {
    expect(PREFIJO_MOTIVO_SIMULADO).toBe(
      'Sugerencia de IA: [SIMULADA — no es un modelo real]',
    );
  });

  it('la etiqueta sola, sin "Sugerencia de IA: ", es IA a secas', () => {
    expect(
      insigniaIa('llm_sugerencia', '[SIMULADA — no es un modelo real] texto'),
    ).toBe('ia');
  });

  it('llm con un motivo real es IA', () => {
    expect(
      insigniaIa('llm_sugerencia', 'Sugerencia de IA: coincide el concepto.'),
    ).toBe('ia');
  });

  it('llm sin motivo es IA', () => {
    expect(insigniaIa('llm_sugerencia', null)).toBe('ia');
  });

  it('una regla que no es llm con el texto del prefijo no lleva insignia', () => {
    expect(insigniaIa('referencia_exacta', SIMULADO)).toBeNull();
  });

  it('el prefijo que no está al inicio no cuenta como simulada', () => {
    expect(insigniaIa('llm_sugerencia', `Nota. ${SIMULADO}`)).toBe('ia');
  });

  it.each(['sin_candidato_monto', 'monto_multiples_candidatos', null])(
    'la regla %s no lleva insignia',
    (regla) => {
      expect(insigniaIa(regla, null)).toBeNull();
    },
  );

  it('una regla desconocida no lleva insignia', () => {
    expect(insigniaIa('regla_nueva', SIMULADO)).toBeNull();
  });
});
