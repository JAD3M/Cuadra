import { describe, expect, it } from 'vitest';
import { clavesCargas } from './claves';

describe('claves de las cargas', () => {
  it('la época va en la posición 1 y no hay token en ninguna clave', () => {
    expect(clavesCargas.todas(3)).toEqual(['cargas', 3]);
    expect(clavesCargas.lista(3)[1]).toBe(3);
    expect(clavesCargas.detalle(3, 'abc')[1]).toBe(3);
    expect(clavesCargas.perfiles(3)[1]).toBe(3);
  });

  it('todas(e) es prefijo de lista, detalle y perfiles de esa época', () => {
    const prefijo = clavesCargas.todas(4);
    expect(clavesCargas.lista(4).slice(0, 2)).toEqual(prefijo);
    expect(clavesCargas.detalle(4, 'x').slice(0, 2)).toEqual(prefijo);
    expect(clavesCargas.perfiles(4).slice(0, 2)).toEqual(prefijo);
  });

  it('son estables y distintas entre sí', () => {
    expect(clavesCargas.lista(1)).toEqual(clavesCargas.lista(1));
    expect(clavesCargas.lista(1)).not.toEqual(clavesCargas.perfiles(1));
    expect(clavesCargas.detalle(1, 'a')).not.toEqual(
      clavesCargas.detalle(1, 'b'),
    );
  });

  it('otra época cambia toda clave: nada se comparte entre épocas', () => {
    expect(clavesCargas.lista(2)).not.toEqual(clavesCargas.lista(1));
    expect(clavesCargas.detalle(2, 'a')).not.toEqual(
      clavesCargas.detalle(1, 'a'),
    );
    expect(clavesCargas.perfiles(2)).not.toEqual(clavesCargas.perfiles(1));
  });

  it('sin sesión lista la época es null y la clave lo conserva', () => {
    expect(clavesCargas.lista(null)).toEqual(['cargas', null, 'lista']);
  });
});

describe('clave de la vista previa (historia 3.4)', () => {
  it('lleva la época en la posición 1, la carga al final y cuelga de todas(e)', () => {
    const clave = clavesCargas.vistaPrevia(5, 'abc');
    expect(clave).toEqual(['cargas', 5, 'vista-previa', 'abc']);
    expect(clave.slice(0, 2)).toEqual(clavesCargas.todas(5));
    expect(clavesCargas.vistaPrevia(6, 'abc')).not.toEqual(clave);
    expect(clavesCargas.vistaPrevia(5, 'def')).not.toEqual(clave);
  });
});
