import { describe, expect, it } from 'vitest';
import { esperarTokensCoherentes } from '@/test/invariantesSesion';
import { crearAlmacenTokens } from './almacenTokens';
import { ESTADO_INICIAL, reducir, type EstadoInterno } from './maquina';

describe('crearAlmacenTokens', () => {
  it('arranca vacío', () => {
    const almacen = crearAlmacenTokens();
    expect(almacen.seleccion()).toBeNull();
    expect(almacen.sesion()).toBeNull();
    expect(almacen.email()).toBeNull();
    expect(almacen.proveedor()()).toBeNull();
  });

  it('guarda el token de selección con su correo y el de sesión', () => {
    const almacen = crearAlmacenTokens();
    almacen.fijarSeleccion('sel-1', 'a@b.mx');
    almacen.fijarSesion('ses-1');
    expect(almacen.seleccion()).toBe('sel-1');
    expect(almacen.email()).toBe('a@b.mx');
    expect(almacen.sesion()).toBe('ses-1');
  });

  it('limpiar descarta todo', () => {
    const almacen = crearAlmacenTokens();
    almacen.fijarSeleccion('sel-1', 'a@b.mx');
    almacen.fijarSesion('ses-1');
    almacen.limpiar();
    expect(almacen.seleccion()).toBeNull();
    expect(almacen.sesion()).toBeNull();
    expect(almacen.email()).toBeNull();
  });

  it('limpiarSeleccion deja la sesión intacta', () => {
    const almacen = crearAlmacenTokens();
    almacen.fijarSeleccion('sel-1', 'a@b.mx');
    almacen.fijarSesion('ses-1');
    almacen.limpiarSeleccion();
    expect(almacen.seleccion()).toBeNull();
    expect(almacen.email()).toBeNull();
    expect(almacen.sesion()).toBe('ses-1');
  });

  it('cada almacén es independiente (no hay estado de módulo)', () => {
    const uno = crearAlmacenTokens();
    const otro = crearAlmacenTokens();
    uno.fijarSesion('ses-1');
    expect(otro.sesion()).toBeNull();
  });

  it('el token de sesión se sustituye sin tocar el de selección', () => {
    const almacen = crearAlmacenTokens();
    almacen.fijarSeleccion('sel-1', 'a@b.mx');
    almacen.fijarSesion('ses-1');
    almacen.fijarSesion('ses-2');
    expect(almacen.sesion()).toBe('ses-2');
    expect(almacen.seleccion()).toBe('sel-1');
  });
});

describe('proveedor del cliente (M4)', () => {
  it('solo expone el token de sesión, nunca el de selección', () => {
    const almacen = crearAlmacenTokens();
    const proveedor = almacen.proveedor();
    almacen.fijarSeleccion('sel-1', 'a@b.mx');
    expect(proveedor()).toBeNull();
    almacen.fijarSesion('ses-1');
    expect(proveedor()).toBe('ses-1');
    expect(proveedor()).not.toBe(almacen.seleccion());
  });

  it('lee el valor vigente en cada llamada', () => {
    const almacen = crearAlmacenTokens();
    const proveedor = almacen.proveedor();
    almacen.fijarSesion('ses-1');
    almacen.limpiar();
    expect(proveedor()).toBeNull();
  });

  it('no deja los tokens como propiedades enumerables ni serializables', () => {
    const almacen = crearAlmacenTokens();
    almacen.fijarSeleccion('sel-secreto', 'a@b.mx');
    almacen.fijarSesion('ses-secreto');
    const serializado = JSON.stringify(almacen);
    expect(serializado).not.toContain('secreto');
    expect(Object.values(almacen).every((v) => typeof v === 'function')).toBe(
      true,
    );
  });
});

describe('esperarTokensCoherentes', () => {
  const usuario = { id: 'u', nombre: 'N', email: 'a@b.mx' };
  const base: Record<string, EstadoInterno> = {
    anonymous: ESTADO_INICIAL,
    seleccion: reducir(ESTADO_INICIAL, {
      tipo: 'LOGIN_OK',
      usuario,
      empresas: [],
    }),
  };
  const sesion = reducir(base.seleccion as EstadoInterno, {
    tipo: 'SELECCION_OK',
    empresaId: 'e',
  });
  const cambio = reducir(sesion, { tipo: 'CAMBIO_OK', empresas: [] });
  const ended = reducir(sesion, { tipo: 'CIERRE' });

  function con(sel: boolean, ses: boolean) {
    const almacen = crearAlmacenTokens();
    if (sel) almacen.fijarSeleccion('s', 'a@b.mx');
    if (ses) almacen.fijarSesion('t');
    return almacen;
  }

  it.each<[string, EstadoInterno, boolean, boolean]>([
    ['anonymous', ESTADO_INICIAL, false, false],
    ['selecting(login)', base.seleccion as EstadoInterno, true, false],
    ['sesion', sesion, true, true],
    ['selecting(cambio)', cambio, true, true],
    ['ended', ended, false, false],
  ])('acepta la combinación válida de %s', (_n, estado, sel, ses) => {
    expect(() => esperarTokensCoherentes(estado, con(sel, ses))).not.toThrow();
  });

  it.each<[string, EstadoInterno, boolean, boolean]>([
    ['anonymous con selección', ESTADO_INICIAL, true, false],
    [
      'selecting(login) con sesión',
      base.seleccion as EstadoInterno,
      true,
      true,
    ],
    ['sesion sin selección', sesion, false, true],
    ['selecting(cambio) sin sesión', cambio, true, false],
    ['ended con sesión', ended, false, true],
  ])('rechaza %s', (_n, estado, sel, ses) => {
    expect(() => esperarTokensCoherentes(estado, con(sel, ses))).toThrow();
  });
});
