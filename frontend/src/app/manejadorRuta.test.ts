import { describe, expect, it } from 'vitest';
import { subtituloDeRuta, tituloDeRuta } from './manejadorRuta';

describe('manejador de ruta', () => {
  it('lee el título de un handle', () => {
    expect(tituloDeRuta({ titulo: 'Cargas' })).toBe('Cargas');
  });

  it('lee el subtítulo cuando el handle lo publica', () => {
    expect(subtituloDeRuta({ titulo: 'Bandeja', subtitulo: 'Apoyo' })).toBe(
      'Apoyo',
    );
  });

  it.each([undefined, null, 'texto', 7, {}, { subtitulo: 3 }])(
    'sin subtítulo válido en %j devuelve undefined',
    (manejador) => {
      expect(subtituloDeRuta(manejador)).toBeUndefined();
    },
  );
});
