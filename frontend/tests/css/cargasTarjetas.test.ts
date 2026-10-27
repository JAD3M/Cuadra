// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const MODULOS = {
  selector: 'features/cargas/components/SelectorArchivos.module.css',
  zona: 'features/cargas/components/ZonaSoltar.module.css',
  fila: 'features/cargas/components/FilaArchivo.module.css',
  lista: 'features/cargas/components/ListaArchivos.module.css',
  campos: 'features/cargas/components/campos.module.css',
  tarjeta: 'features/cargas/components/tarjeta.module.css',
  region: 'features/cargas/components/RegionResultado.module.css',
  contenedor: 'features/cargas/CargasContenedor.module.css',
} as const;

const css = Object.fromEntries(
  Object.entries(MODULOS).map(([nombre, ruta]) => [
    nombre,
    leerModuloCss(ruta),
  ]),
) as Record<keyof typeof MODULOS, string>;

describe('contrato CSS de las tarjetas de subida', () => {
  it('solo usa tokens: sin literales de color en ningún módulo', () => {
    for (const [nombre, fuente] of Object.entries(css)) {
      expect(fuente, nombre).not.toMatch(LITERAL_DE_COLOR);
    }
  });

  it('el botón de elegir archivos pinta el foco con :focus-within (el input va oculto)', () => {
    const foco = bloqueCss(css.selector, '.selector:focus-within');
    expect(foco).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });

  it('los botones de elegir archivos miden al menos 44 px', () => {
    expect(bloqueCss(css.selector, '.primario')).toContain(
      'min-block-size: var(--control-height)',
    );
    expect(bloqueCss(css.selector, '.secundario')).toContain(
      'min-block-size: var(--touch-min)',
    );
  });

  it('deshabilitado no depende solo del color: borde discontinuo', () => {
    expect(
      bloqueCss(css.selector, ".selector[data-deshabilitado='true']"),
    ).toMatch(/border-style:\s*dashed/);
    expect(bloqueCss(css.campos, '.control:disabled')).toMatch(
      /border-style:\s*dashed/,
    );
  });

  it('la zona de soltar usa el fondo hundido y, al arrastrar, borde continuo con el acento', () => {
    expect(bloqueCss(css.zona, '.zona')).toContain('var(--color-inset)');
    const arrastre = bloqueCss(css.zona, ".zona[data-arrastrando='true']");
    expect(arrastre).toMatch(/border-style:\s*solid/);
    expect(arrastre).toContain('var(--color-accent)');
    expect(arrastre).toContain('var(--estado-sugerencia-tile-bg)');
  });

  it('las filas usan el fondo hundido y la rechazada, el tinte y el borde de peligro', () => {
    expect(bloqueCss(css.fila, '.fila')).toContain('var(--color-inset)');
    const rechazada = bloqueCss(css.fila, ".fila[data-rechazado='true']");
    expect(rechazada).toContain('var(--color-danger-tint)');
    expect(rechazada).toContain('var(--color-danger-border)');
    expect(
      bloqueCss(css.fila, ".fila[data-rechazado='true'] .detalle"),
    ).toContain('var(--color-danger-title)');
  });

  it('el peso de una fila no se parte ni se recorta', () => {
    const peso = bloqueCss(css.fila, '.peso');
    expect(peso).toMatch(/white-space:\s*nowrap/);
    expect(peso).not.toMatch(/overflow|text-overflow|max-inline-size|width/);
  });

  it('la lista se desplaza y nunca recorta', () => {
    const region = bloqueCss(css.lista, '.region');
    expect(region).toMatch(/overflow:\s*auto/);
    expect(region).not.toMatch(/overflow:\s*hidden/);
    expect(bloqueCss(css.lista, '.region:focus-visible')).toContain(
      'var(--color-accent)',
    );
  });

  it('el error de perfiles usa el título de peligro y Reintentar parece un enlace de 44 px, sin literales', () => {
    expect(bloqueCss(css.campos, '.errorPerfiles')).toContain(
      'var(--color-danger-title)',
    );
    const enlace = bloqueCss(css.campos, '.enlace');
    expect(enlace).toContain('var(--color-link)');
    expect(enlace).toContain('min-block-size: var(--touch-min)');
    expect(enlace).toMatch(/white-space:\s*nowrap/);
    expect(bloqueCss(css.campos, '.enlace:focus-visible')).toContain(
      'var(--color-accent)',
    );
  });

  it('los campos usan el fondo hundido y la etiqueta no va en mayúsculas', () => {
    expect(bloqueCss(css.campos, '.control')).toContain('var(--color-inset)');
    expect(bloqueCss(css.campos, '.etiqueta')).not.toMatch(/uppercase/);
  });

  it('la tarjeta usa superficie y borde por token y la rejilla de campos no desborda', () => {
    const tarjeta = bloqueCss(css.tarjeta, '.tarjeta');
    expect(tarjeta).toContain('var(--color-surface)');
    expect(tarjeta).toContain('var(--color-border)');
    expect(tarjeta).toMatch(/min-inline-size:\s*0/);
    expect(bloqueCss(css.tarjeta, '.rejilla')).toContain('minmax(0, 1fr)');
  });

  it('el rótulo del CFDI usa el color de enlace y el del estado de cuenta, el del estado sin match', () => {
    expect(bloqueCss(css.tarjeta, '.rotuloCfdi')).toContain(
      'var(--color-link)',
    );
    expect(bloqueCss(css.tarjeta, '.rotuloCsv')).toContain(
      'var(--estado-sin-match-text)',
    );
  });

  it('la región de estado muestra el foco que recibe por código', () => {
    expect(bloqueCss(css.region, '.region:focus-visible')).toContain(
      'var(--color-accent)',
    );
  });

  it('las dos tarjetas van en dos columnas y pasan a una con 900 px o menos', () => {
    expect(bloqueCss(css.contenedor, '.tarjetas')).toContain(
      'repeat(2, minmax(0, 1fr))',
    );
    const estrecho = css.contenedor.slice(
      css.contenedor.indexOf('@media (max-width: 900px)'),
    );
    expect(estrecho).toContain('@media (max-width: 900px)');
    expect(estrecho).toMatch(/grid-template-columns:\s*1fr/);
  });

  it('solo la lista en subida se atenúa con opacity; ningún otro módulo lo usa', () => {
    for (const [nombre, fuente] of Object.entries(css)) {
      if (nombre === 'lista') continue;
      expect(fuente, nombre).not.toMatch(/opacity/);
    }
  });
});
