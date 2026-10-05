import { describe, expect, it } from 'vitest';
import { destinoSeguro, destinoTrasAcceso, estadoAcceso } from './destino';

describe('destinoSeguro', () => {
  it.each([
    ['//evil.com', { pathname: '//evil.com' }],
    ['barra y barra invertida', { pathname: '/\\evil.com' }],
    ['https://evil.com', { pathname: 'https://evil.com' }],
    ['javascript:', { pathname: 'javascript:alert(1)' }],
    ['vacío', { pathname: '' }],
    ['/login', { pathname: '/login' }],
    ['/login con otra caja', { pathname: '/LOGIN' }],
    ['/empresa', { pathname: '/empresa' }],
    ['/empresa/x', { pathname: '/empresa/x' }],
    ['/login/', { pathname: '/login/' }],
    ['segmento ..', { pathname: '/a/../login' }],
    ['segmento . ', { pathname: '/a/./b' }],
    ['segmento .. codificado', { pathname: '/a/%2e%2e/b' }],
    ['salto de línea', { pathname: '/a\nb' }],
    ['carácter de control', { pathname: '/a\u0000b' }],
    ['espacio', { pathname: '/a b' }],
    ['pathname numérico', { pathname: 7 }],
    ['sin pathname', { search: '?x=1' }],
    ['cadena', '/casos/9'],
    ['número', 42],
    ['null', null],
    ['undefined', undefined],
    ['arreglo', ['/casos/9']],
  ])('rechaza %s', (_nombre, valor) => {
    expect(destinoSeguro(valor)).toBeNull();
  });

  it('acepta una ruta interna', () => {
    expect(destinoSeguro({ pathname: '/casos/9' })).toEqual({
      pathname: '/casos/9',
    });
  });

  it('acepta search y hash válidos', () => {
    expect(
      destinoSeguro({ pathname: '/bandeja', search: '?x=1', hash: '#y' }),
    ).toEqual({ pathname: '/bandeja', search: '?x=1', hash: '#y' });
  });

  it('descarta search y hash inválidos y conserva la ruta', () => {
    expect(
      destinoSeguro({ pathname: '/bandeja', search: 'x=1', hash: 'y' }),
    ).toEqual({ pathname: '/bandeja' });
    expect(
      destinoSeguro({ pathname: '/bandeja', search: '?a b', hash: '#a\nb' }),
    ).toEqual({ pathname: '/bandeja' });
    expect(
      destinoSeguro({ pathname: '/bandeja', search: 1, hash: null }),
    ).toEqual({ pathname: '/bandeja' });
  });

  it('descarta propiedades que no conoce', () => {
    expect(destinoSeguro({ pathname: '/bandeja', token: 'x' })).toEqual({
      pathname: '/bandeja',
    });
  });

  it('acota el largo total a 2048', () => {
    const justo = '/' + 'a'.repeat(2047);
    expect(destinoSeguro({ pathname: justo })).toEqual({ pathname: justo });
    expect(destinoSeguro({ pathname: justo + 'a' })).toBeNull();
    expect(
      destinoSeguro({ pathname: '/a', search: '?' + 'b'.repeat(2047) }),
    ).toBeNull();
  });
});

describe('estadoAcceso', () => {
  it('devuelve vacío para lo que no es un objeto', () => {
    expect(estadoAcceso(null)).toEqual({});
    expect(estadoAcceso('x')).toEqual({});
    expect(estadoAcceso(undefined)).toEqual({});
  });

  it('conserva un from seguro y el foco conocido', () => {
    expect(
      estadoAcceso({ from: { pathname: '/casos/9' }, foco: 'correo' }),
    ).toEqual({ from: { pathname: '/casos/9' }, foco: 'correo' });
  });

  it('descarta un from hostil y un foco desconocido', () => {
    expect(
      estadoAcceso({ from: { pathname: '//evil.com' }, foco: 'x' }),
    ).toEqual({});
  });
});

describe('destinoTrasAcceso', () => {
  const state = { from: { pathname: '/casos/9', search: '?x=1' } };

  it('con restaurarOrigen devuelve el destino guardado', () => {
    expect(destinoTrasAcceso(state, { restaurarOrigen: true })).toEqual({
      pathname: '/casos/9',
      search: '?x=1',
    });
  });

  it('con restaurarOrigen falso devuelve /bandeja aunque haya un from válido (B)', () => {
    expect(destinoTrasAcceso(state, { restaurarOrigen: false })).toEqual({
      pathname: '/bandeja',
    });
  });

  it('sin destino o con uno hostil devuelve /bandeja', () => {
    expect(destinoTrasAcceso(null, { restaurarOrigen: true })).toEqual({
      pathname: '/bandeja',
    });
    expect(
      destinoTrasAcceso(
        { from: { pathname: '/login' } },
        { restaurarOrigen: true },
      ),
    ).toEqual({ pathname: '/bandeja' });
  });
});
