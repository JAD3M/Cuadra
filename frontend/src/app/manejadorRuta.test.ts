import { describe, expect, it } from 'vitest';
import {
  subtituloDeRuta,
  tituloDeRuta,
  tituloDocumentoDeRuta,
} from './manejadorRuta';

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

describe('manejador de ruta: subtítulo con la empresa activa', () => {
  const conEmpresa = {
    titulo: 'Tolerancia de monto',
    subtituloConEmpresa: (empresa: string) => `${empresa} · apoyo`,
  };

  it('arma el subtítulo con el nombre de la empresa', () => {
    expect(subtituloDeRuta(conEmpresa, 'Ferretería')).toBe(
      'Ferretería · apoyo',
    );
    expect(subtituloDeRuta(conEmpresa, 'Abarrotes')).toBe('Abarrotes · apoyo');
  });

  it('sin empresa no hay subtítulo dinámico que armar', () => {
    expect(subtituloDeRuta(conEmpresa)).toBeUndefined();
  });

  it('sin empresa cae en el subtítulo estático si la ruta también lo declara', () => {
    expect(subtituloDeRuta({ ...conEmpresa, subtitulo: 'Estático' })).toBe(
      'Estático',
    );
  });

  it('una ruta con subtítulo estático lo conserva aunque haya empresa', () => {
    expect(
      subtituloDeRuta({ titulo: 'Cargas', subtitulo: 'Apoyo' }, 'Ferretería'),
    ).toBe('Apoyo');
  });

  it('un subtituloConEmpresa que no es función se ignora', () => {
    expect(
      subtituloDeRuta(
        { subtituloConEmpresa: 'texto', subtitulo: 'Apoyo' },
        'X',
      ),
    ).toBe('Apoyo');
  });
});

describe('manejador de ruta: título del documento', () => {
  it('usa «<título> · Cuadra» por omisión', () => {
    expect(tituloDocumentoDeRuta({ titulo: 'Cargas' })).toBe('Cargas · Cuadra');
  });

  it('prefiere el tituloDocumento de la ruta al del encabezado', () => {
    expect(
      tituloDocumentoDeRuta({
        titulo: 'Tolerancia de monto',
        tituloDocumento: 'Tolerancia · Cuadra',
      }),
    ).toBe('Tolerancia · Cuadra');
  });

  it.each([undefined, null, 'texto', 7, {}])(
    'sin título en %j devuelve undefined',
    (manejador) => {
      expect(tituloDocumentoDeRuta(manejador)).toBeUndefined();
    },
  );
});
