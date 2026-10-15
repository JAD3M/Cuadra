import { describe, expect, it } from 'vitest';
import { textoEnviada, textoVence } from './vencimiento';

const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-15T12:00:00.000Z');

describe('textoVence', () => {
  it('una vencida (según el servidor) dice «Vencida» aunque la fecha sea futura', () => {
    expect(textoVence('2026-10-30T12:00:00.000Z', true, AHORA)).toEqual({
      texto: 'Vencida',
      vencida: true,
    });
  });

  it('una vigente cuenta los días que faltan, redondeando hacia arriba', () => {
    expect(
      textoVence(new Date(AHORA + 6 * DIA).toISOString(), false, AHORA).texto,
    ).toBe('Vence en 6 días');
    expect(
      textoVence(new Date(AHORA + 5.2 * DIA).toISOString(), false, AHORA).texto,
    ).toBe('Vence en 6 días');
  });

  it('un día se dice en singular y nunca baja de uno', () => {
    expect(
      textoVence(new Date(AHORA + 0.4 * DIA).toISOString(), false, AHORA).texto,
    ).toBe('Vence en 1 día');
    // El reloj del navegador no decide la validez: el servidor dijo vigente.
    const r = textoVence(new Date(AHORA - DIA).toISOString(), false, AHORA);
    expect(r).toEqual({ texto: 'Vence en 1 día', vencida: false });
  });
});

describe('textoEnviada', () => {
  it('toma el día del texto ISO sin pasar por la zona horaria', () => {
    expect(textoEnviada('2026-10-14T23:30:00.000Z')).toBe('2026-10-14');
  });

  it('una cadena con otra forma se devuelve tal cual', () => {
    expect(textoEnviada('ayer')).toBe('ayer');
  });
});
