// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { razonContraste } from '../contraste/razonContraste';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';
import { leerColores, RAIZ_FRONTEND, type Tema } from './leerTokens';

/** Los contratos miran las declaraciones, no lo que dicen los comentarios. */
const sinComentarios = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, '');

const tarjeta = sinComentarios(
  leerModuloCss('features/tolerancia/components/TarjetaValor.module.css'),
);
const aviso = sinComentarios(
  leerModuloCss('features/tolerancia/components/AvisoSoloAdmin.module.css'),
);
const formulario = sinComentarios(
  leerModuloCss(
    'features/tolerancia/components/FormularioTolerancia.module.css',
  ),
);
const cambios = sinComentarios(
  leerModuloCss('features/tolerancia/components/TarjetaCambios.module.css'),
);
const contenedor = sinComentarios(
  leerModuloCss('features/tolerancia/ToleranciaContenedor.module.css'),
);

/** Módulos de la pantalla de Tolerancia que ya existen en esta rebanada. */
const MODULOS: readonly (readonly [string, string])[] = [
  ['TarjetaValor', tarjeta],
  ['AvisoSoloAdmin', aviso],
  ['FormularioTolerancia', formulario],
  ['TarjetaCambios', cambios],
  ['ToleranciaContenedor', contenedor],
];

describe.each(MODULOS)('contrato CSS de %s', (_nombre, css) => {
  it('solo usa tokens: sin literales de color (TOL-11.3)', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });

  it('no usa opacity para atenuar nada', () => {
    expect(css).not.toMatch(/opacity/);
  });
});

describe('contrato CSS del monto del valor (TOL-1.7)', () => {
  it('el monto no se parte en dos líneas', () => {
    expect(bloqueCss(tarjeta, '.monto')).toMatch(/white-space:\s*nowrap/);
  });

  it('nada recorta el monto: ningún overflow hidden en el módulo', () => {
    expect(tarjeta).not.toMatch(/overflow(-x|-y)?:\s*hidden/);
  });

  it('la fuente crece con el ancho de la tarjeta entre dos tokens', () => {
    const monto = bloqueCss(tarjeta, '.monto');
    expect(monto).toMatch(
      /font-size:\s*clamp\(var\(--text-hero\),\s*[\d.]+cqi,\s*var\(--text-display-xl\)\)/,
    );
    expect(bloqueCss(tarjeta, '.tarjeta')).toMatch(
      /container-type:\s*inline-size/,
    );
  });

  it('la fila del valor deja caer «MXN» y desplaza como último recurso', () => {
    const valor = bloqueCss(tarjeta, '.valor');
    expect(valor).toMatch(/flex-wrap:\s*wrap/);
    expect(valor).toMatch(/overflow-x:\s*auto/);
  });

  it('el monto va en mono, con el acento del estado sin match', () => {
    const monto = bloqueCss(tarjeta, '.monto');
    expect(monto).toContain('var(--font-mono)');
    expect(monto).toContain('var(--estado-sin-match-accent)');
  });

  it('la tarjeta usa las superficies de las otras tarjetas', () => {
    const bloque = bloqueCss(tarjeta, '.tarjeta');
    expect(bloque).toContain('var(--color-surface)');
    expect(bloque).toContain('var(--color-border)');
  });
});

describe('contrato CSS del aviso de solo administrador', () => {
  it('vive sobre el fondo hundido con el texto suave', () => {
    const bloque = bloqueCss(aviso, '.aviso');
    expect(bloque).toContain('var(--color-inset)');
    expect(bloque).toContain('var(--color-text-soft)');
  });

  it('el candado usa el color secundario', () => {
    expect(bloqueCss(aviso, '.icono')).toContain('var(--color-text-secondary)');
  });
});

describe('contrato CSS del formulario', () => {
  it('el campo es mono, grande y de 52 px como mínimo (TOL-11)', () => {
    const campo = bloqueCss(formulario, '.campo');
    expect(campo).toContain('var(--font-mono)');
    expect(campo).toContain('var(--text-2xl)');
    expect(campo).toMatch(/min-block-size:\s*var\(--control-height-lg\)/);
  });

  it('el campo vive sobre el fondo hundido con borde y texto de rol', () => {
    const campo = bloqueCss(formulario, '.campo');
    expect(campo).toContain('var(--color-inset)');
    expect(campo).toContain('var(--color-border-strong)');
    expect(campo).toContain('var(--color-text)');
  });

  it('el campo inválido cambia el borde a danger, además del mensaje', () => {
    expect(bloqueCss(formulario, ".campo[aria-invalid='true']")).toContain(
      'var(--color-danger)',
    );
  });

  it('el foco del campo se ve: anillo de acento', () => {
    const foco = bloqueCss(formulario, '.campo:focus-visible');
    expect(foco).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });

  it('el campo deshabilitado no depende solo del color: borde discontinuo', () => {
    const apagado = bloqueCss(formulario, '.campo:disabled');
    expect(apagado).toMatch(/border-style:\s*dashed/);
    expect(apagado).toContain('var(--color-text-secondary)');
  });

  it('«Guardar» mide 52 px como mínimo con mayor especificidad que el botón base', () => {
    const guardar = bloqueCss(formulario, '.fila .guardar');
    expect(guardar).toMatch(/min-block-size:\s*var\(--control-height-lg\)/);
  });

  it('el campo y el botón comparten fila y caen en pantallas angostas', () => {
    expect(bloqueCss(formulario, '.fila')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('cada ayuda usa su rol: normal muted, igual secundario, error danger-text', () => {
    expect(bloqueCss(formulario, '.ayuda')).toContain('var(--color-muted)');
    expect(bloqueCss(formulario, '.igual')).toContain(
      'var(--color-text-secondary)',
    );
    expect(bloqueCss(formulario, '.error')).toContain(
      'var(--color-danger-text)',
    );
  });

  it('el éxito usa los roles del estado conciliado, no el texto del tema', () => {
    const exito = bloqueCss(formulario, '.exito');
    expect(exito).toContain('var(--estado-conciliado-tile-bg)');
    expect(exito).toContain('var(--estado-conciliado-tile-border)');
    expect(exito).toContain('var(--estado-conciliado-text)');
    expect(bloqueCss(formulario, '.iconoExito')).toContain(
      'var(--estado-conciliado-accent)',
    );
  });

  it('la región de estado vacía no abre hueco en la columna', () => {
    expect(bloqueCss(formulario, '.region')).toMatch(/display:\s*contents/);
  });

  it('nada del formulario recorta contenido con overflow hidden', () => {
    expect(formulario).not.toMatch(/overflow(-x|-y)?:\s*hidden/);
  });
});

describe('token del monto grande', () => {
  it('--text-display-xl vale 88px y se declara una vez', () => {
    const base = fs
      .readFileSync(
        path.join(RAIZ_FRONTEND, 'src/shared/styles/tokens/base.css'),
        'utf8',
      )
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const declaraciones = [
      ...base.matchAll(/(--text-display-xl)\s*:\s*([^;]+);/g),
    ];
    expect(declaraciones).toHaveLength(1);
    expect(declaraciones[0]?.[2]?.trim()).toBe('88px');
  });
});

/**
 * Pares texto-sobre-fondo de la tarjeta del valor y del aviso. Ninguno es nuevo
 * (están en `contraste.test.ts`); este contrato falla si el módulo pasa a un par
 * que nadie midió.
 *  - título de la tarjeta: muted sobre surface
 *  - monto: sin-match-accent sobre surface
 *  - «MXN»: text-secondary sobre surface
 *  - párrafo: text-soft sobre surface
 *  - aviso: text-soft y text-secondary (candado) sobre inset
 */
const PARES: readonly (readonly [string, string])[] = [
  ['--color-muted', '--color-surface'],
  ['--estado-sin-match-accent', '--color-surface'],
  ['--color-text-secondary', '--color-surface'],
  ['--color-text-soft', '--color-surface'],
  ['--color-text-soft', '--color-inset'],
  ['--color-text-secondary', '--color-inset'],
];

describe.each<Tema>(['dark', 'light'])(
  'contraste de la tarjeta del valor y del aviso, tema %s',
  (tema) => {
    it.each(PARES)('%s sobre %s alcanza 4.5:1', (fg, bg) => {
      const tokens = leerColores()[tema];
      const primero = tokens[fg];
      const segundo = tokens[bg];
      if (!primero || !segundo) throw new Error(`Falta ${fg} o ${bg}`);
      const r = razonContraste(primero, segundo);
      expect(
        r,
        `tema ${tema}: ${fg} sobre ${bg} mide ${r.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  },
);

/**
 * Pares del formulario. Ninguno es nuevo (están en `contraste.test.ts`); este
 * contrato falla si el módulo pasa a un par que nadie midió.
 *  - etiqueta y «es el valor actual»: text-secondary sobre surface
 *  - ayuda normal: muted sobre surface
 *  - mensaje de validación: danger-text sobre surface
 *  - texto del campo: text sobre inset; deshabilitado: text-secondary sobre inset
 *  - éxito: conciliado-text y conciliado-accent (icono) sobre su baldosa
 * El borde del campo (border-strong) y el relleno del botón deshabilitado son
 * decorativos o exentos y quedan fuera, igual que en el `Campo` compartido.
 */
const PARES_FORMULARIO: readonly (readonly [string, string])[] = [
  ['--color-text-secondary', '--color-surface'],
  ['--color-muted', '--color-surface'],
  ['--color-danger-text', '--color-surface'],
  ['--color-text', '--color-inset'],
  ['--color-text-secondary', '--color-inset'],
  ['--estado-conciliado-text', '--estado-conciliado-tile-bg'],
  ['--estado-conciliado-accent', '--estado-conciliado-tile-bg'],
];

describe.each<Tema>(['dark', 'light'])(
  'contraste del formulario de tolerancia, tema %s',
  (tema) => {
    it.each(PARES_FORMULARIO)('%s sobre %s alcanza 4.5:1', (fg, bg) => {
      const tokens = leerColores()[tema];
      const primero = tokens[fg];
      const segundo = tokens[bg];
      if (!primero || !segundo) throw new Error(`Falta ${fg} o ${bg}`);
      const r = razonContraste(primero, segundo);
      expect(
        r,
        `tema ${tema}: ${fg} sobre ${bg} mide ${r.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  },
);

describe('contrato CSS de la tarjeta de cambios (TOL-10.5)', () => {
  it('el importe de cada fila no se parte en dos líneas', () => {
    expect(bloqueCss(cambios, '.importes')).toMatch(/white-space:\s*nowrap/);
  });

  it('la fecha no se parte en dos líneas', () => {
    expect(bloqueCss(cambios, '.fecha')).toMatch(/white-space:\s*nowrap/);
  });

  it('el nombre de quien cambió sí se parte, sin romper la tarjeta', () => {
    expect(bloqueCss(cambios, '.autor')).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('nada recorta el contenido: ningún overflow hidden ni nowrap en el autor', () => {
    expect(cambios).not.toMatch(/overflow(-x|-y)?:\s*hidden/);
    expect(bloqueCss(cambios, '.autor')).not.toMatch(/nowrap/);
  });

  it('los importes van en mono; el nuevo más reciente con el acento, el resto atenuado (TOL-10.12)', () => {
    expect(bloqueCss(cambios, '.importes')).toContain('var(--font-mono)');
    expect(bloqueCss(cambios, '.antes')).toContain(
      'var(--color-text-secondary)',
    );
    expect(bloqueCss(cambios, '.despues')).toContain('var(--color-text-soft)');
    expect(bloqueCss(cambios, '.despuesReciente')).toContain(
      'var(--estado-sin-match-accent)',
    );
  });

  it('la línea del autor y la fecha usa el color secundario', () => {
    expect(bloqueCss(cambios, '.detalle')).toContain(
      'var(--color-text-secondary)',
    );
  });

  it('la tarjeta usa las superficies de las otras tarjetas y el divisor sutil', () => {
    const bloque = bloqueCss(cambios, '.tarjeta');
    expect(bloque).toContain('var(--color-surface)');
    expect(bloque).toContain('var(--color-border)');
    expect(bloqueCss(cambios, '.fila')).toContain('var(--color-border-subtle)');
  });
});

/**
 * Pares texto-sobre-fondo de la tarjeta de cambios. Ninguno es nuevo (están en
 * `contraste.test.ts`); este contrato falla si el módulo pasa a un par que
 * nadie midió.
 *  - título de la tarjeta: muted sobre surface
 *  - «antes», autor y fecha, detalle del vacío: text-secondary sobre surface
 *  - «después» atenuado: text-soft sobre surface
 *  - «después» reciente: sin-match-accent sobre surface
 *  - «Aún no hay cambios.»: text sobre surface
 * El divisor y las barras del esqueleto (border-subtle) son decorativos.
 */
const PARES_CAMBIOS: readonly (readonly [string, string])[] = [
  ['--color-muted', '--color-surface'],
  ['--color-text-secondary', '--color-surface'],
  ['--color-text-soft', '--color-surface'],
  ['--estado-sin-match-accent', '--color-surface'],
  ['--color-text', '--color-surface'],
];

describe.each<Tema>(['dark', 'light'])(
  'contraste de la tarjeta de cambios, tema %s',
  (tema) => {
    it.each(PARES_CAMBIOS)('%s sobre %s alcanza 4.5:1', (fg, bg) => {
      const tokens = leerColores()[tema];
      const primero = tokens[fg];
      const segundo = tokens[bg];
      if (!primero || !segundo) throw new Error(`Falta ${fg} o ${bg}`);
      const r = razonContraste(primero, segundo);
      expect(
        r,
        `tema ${tema}: ${fg} sobre ${bg} mide ${r.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  },
);
