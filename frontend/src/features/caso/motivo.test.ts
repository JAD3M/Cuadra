import { describe, expect, it } from 'vitest';
import { MOTIVO_MAXIMO } from '@/shared/dominio';
import { contarCaracteres, excedeLimite, motivoParaEnvio } from './motivo';

const letras = (n: number) => 'a'.repeat(n);

describe('contarCaracteres', () => {
  it.each([0, 1, 120, 500, 501])('cuenta %i caracteres', (n) => {
    expect(contarCaracteres(letras(n))).toBe(n);
  });

  it('cuenta puntos de código: un emoji vale uno, como en el backend', () => {
    expect(contarCaracteres('😀')).toBe(1);
    expect(contarCaracteres('a😀b')).toBe(3);
    expect('😀'.length).toBe(2);
  });

  it('B8: cuenta el texto tal cual, con los espacios de las orillas', () => {
    expect(contarCaracteres('  hola  ')).toBe(8);
  });
});

describe('excedeLimite', () => {
  it('el límite viene del espejo del backend', () => {
    expect(MOTIVO_MAXIMO).toBe(500);
  });

  it('500 exactos no exceden; 501 sí', () => {
    expect(excedeLimite(letras(500))).toBe(false);
    expect(excedeLimite(letras(501))).toBe(true);
  });

  it('B8: valida con el texto recortado: espacios finales no cuentan', () => {
    expect(excedeLimite(`${letras(500)}   `)).toBe(false);
    expect(excedeLimite(`   ${letras(500)}`)).toBe(false);
    expect(excedeLimite(`${letras(501)}   `)).toBe(true);
  });

  it('un texto con emojis se mide en puntos de código', () => {
    expect(excedeLimite('😀'.repeat(500))).toBe(false);
    expect(excedeLimite('😀'.repeat(501))).toBe(true);
  });

  it('vacío o solo espacios no excede', () => {
    expect(excedeLimite('')).toBe(false);
    expect(excedeLimite('   ')).toBe(false);
  });
});

describe('motivoParaEnvio', () => {
  it('devuelve el texto recortado', () => {
    expect(motivoParaEnvio('  Monto no corresponde  ')).toBe(
      'Monto no corresponde',
    );
  });

  it('vacío o solo espacios no envía motivo', () => {
    expect(motivoParaEnvio('')).toBeUndefined();
    expect(motivoParaEnvio(' \n\t ')).toBeUndefined();
  });
});
