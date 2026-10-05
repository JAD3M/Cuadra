import { describe, expect, expectTypeOf, it } from 'vitest';
import type { MotivoSalida } from '@/shared/sesion';
import {
  AVISOS,
  primeraPalabra,
  saludoCambio,
  saludoEmpresas,
  textoAviso,
  textoEmpresas,
  type MotivoAviso,
} from './textos';

describe('avisos de acceso', () => {
  it.each([
    [
      'sesion_expirada',
      'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
    ],
    ['sin_acceso', 'Ya no tienes acceso a esta empresa.'],
    ['cierre_voluntario', 'Cerraste sesión.'],
    [
      'reingreso',
      'Por seguridad, vuelve a ingresar tu contraseña para cambiar de empresa.',
    ],
    [
      'seleccion_vencida',
      'Tu tiempo para elegir empresa terminó. Vuelve a iniciar sesión.',
    ],
    [
      'sin_empresas',
      'Tu usuario no tiene empresas asignadas. Contacta a un administrador.',
    ],
  ] as const)('%s dice "%s"', (motivo, texto) => {
    expect(textoAviso(motivo)).toBe(texto);
  });

  it('cubre exactamente los motivos de salida de la sesión salvo ninguno', () => {
    // Todo motivo de la sesión tiene aviso y viceversa (comprobación de tipos).
    expectTypeOf<MotivoAviso>().toEqualTypeOf<MotivoSalida>();
    expect(Object.keys(AVISOS)).toHaveLength(6);
  });

  it('ningún aviso lleva contadores ni cifras', () => {
    for (const texto of Object.values(AVISOS)) expect(texto).not.toMatch(/\d/);
  });
});

describe('textoEmpresas', () => {
  it.each([
    [1, 'una empresa'],
    [2, 'dos empresas'],
    [3, 'tres empresas'],
    [10, 'diez empresas'],
    [11, '11 empresas'],
    [12, '12 empresas'],
  ])('%i -> %s', (n, texto) => {
    expect(textoEmpresas(n)).toBe(texto);
  });
});

describe('saludos', () => {
  it('toma la primera palabra del nombre', () => {
    expect(primeraPalabra('  Jorge Tapia Ruiz ')).toBe('Jorge');
    expect(primeraPalabra('')).toBe('');
    expect(primeraPalabra('   ')).toBe('');
  });

  it('saluda con nombre y número de empresas', () => {
    expect(saludoEmpresas('Jorge Tapia', 2)).toBe(
      'Hola, Jorge. Tienes acceso a dos empresas.',
    );
    expect(saludoEmpresas('Ana', 1)).toBe(
      'Hola, Ana. Tienes acceso a una empresa.',
    );
  });

  it('sin nombre saluda sin nombre', () => {
    expect(saludoEmpresas('', 3)).toBe('Hola. Tienes acceso a tres empresas.');
  });

  it('el saludo de cambio nombra la empresa actual o cae a uno neutro', () => {
    expect(saludoCambio('Ferretería del Bajío')).toBe(
      'Estás en Ferretería del Bajío. Elige la empresa a la que quieres cambiar.',
    );
    expect(saludoCambio()).toBe('Elige la empresa a la que quieres cambiar.');
  });
});
