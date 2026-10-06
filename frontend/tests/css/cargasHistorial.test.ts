// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const MODULOS = {
  barra: 'features/cargas/components/BarraAvance.module.css',
  fila: 'features/cargas/components/FilaCarga.module.css',
  tabla: 'features/cargas/components/TablaCargas.module.css',
  historial: 'features/cargas/components/HistorialCargas.module.css',
  esqueleto: 'features/cargas/components/EsqueletoCargas.module.css',
  vacio: 'features/cargas/components/VacioCargas.module.css',
  error: 'features/cargas/components/ErrorCargas.module.css',
} as const;

const css = Object.fromEntries(
  Object.entries(MODULOS).map(([nombre, ruta]) => [
    nombre,
    leerModuloCss(ruta),
  ]),
) as Record<keyof typeof MODULOS, string>;

/** El bloque `@media (prefers-reduced-motion: reduce) { ... }` completo. */
function bloqueReducirMovimiento(fuente: string): string {
  const inicio = fuente.indexOf('@media (prefers-reduced-motion: reduce)');
  if (inicio < 0) throw new Error('Sin bloque prefers-reduced-motion: reduce');
  let profundidad = 0;
  for (let i = fuente.indexOf('{', inicio); i < fuente.length; i += 1) {
    if (fuente[i] === '{') profundidad += 1;
    if (fuente[i] === '}') {
      profundidad -= 1;
      if (profundidad === 0) return fuente.slice(inicio, i + 1);
    }
  }
  throw new Error('Bloque prefers-reduced-motion sin cerrar');
}

describe('contrato CSS del historial de cargas', () => {
  it('solo usa tokens: sin literales de color en ningún módulo', () => {
    for (const [nombre, fuente] of Object.entries(css)) {
      expect(fuente, nombre).not.toMatch(LITERAL_DE_COLOR);
    }
  });

  it('los contadores no se parten y no se recortan (2.4)', () => {
    const contador = bloqueCss(css.fila, '.contador');
    expect(contador).toMatch(/white-space:\s*nowrap/);
    expect(contador).not.toMatch(
      /overflow|text-overflow|max-inline-size|max-width|inline-size|width/,
    );
  });

  it('la fecha no se parte y no se recorta, en mono', () => {
    const fecha = bloqueCss(css.fila, '.fecha');
    expect(fecha).toMatch(/white-space:\s*nowrap/);
    expect(fecha).toContain('var(--font-mono)');
    expect(fecha).not.toMatch(/overflow|text-overflow|max-inline-size/);
  });

  it('solo el nombre del archivo se trunca, con puntos suspensivos', () => {
    const nombre = bloqueCss(css.fila, '.nombre');
    expect(nombre).toMatch(/text-overflow:\s*ellipsis/);
    expect(nombre).toMatch(/overflow:\s*hidden/);
    for (const [selector, fuente] of [
      ['.contador', css.fila],
      ['.fecha', css.fila],
    ] as const) {
      expect(bloqueCss(fuente, selector)).not.toMatch(/overflow/);
    }
  });

  it('Con error resalta con el token del estado sin match; lo atenuado, con el secundario', () => {
    expect(bloqueCss(css.fila, '.conError')).toContain(
      'var(--estado-sin-match-text)',
    );
    expect(bloqueCss(css.fila, '.atenuado')).toContain(
      'var(--color-text-secondary)',
    );
    expect(bloqueCss(css.fila, '.contador')).toContain('var(--color-text)');
  });

  it('la pista del avance usa el borde sutil y los rellenos, los acentos del estado', () => {
    expect(bloqueCss(css.barra, '.pista')).toContain(
      'var(--color-border-subtle)',
    );
    expect(bloqueCss(css.barra, '.indeterminada')).toContain(
      'var(--estado-sugerencia-accent)',
    );
    expect(bloqueCss(css.barra, '.verde')).toContain(
      'var(--estado-conciliado-accent)',
    );
    expect(bloqueCss(css.barra, '.naranja')).toContain(
      'var(--estado-sin-match-accent)',
    );
    expect(bloqueCss(css.barra, '.roja')).toContain('var(--color-danger)');
  });

  it('pendiente no pinta relleno y los terminales lo llenan', () => {
    expect(bloqueCss(css.barra, '.vacia')).toMatch(/inline-size:\s*0/);
    for (const clase of ['.verde', '.naranja', '.roja']) {
      expect(bloqueCss(css.barra, clase)).toMatch(/inline-size:\s*100%/);
    }
  });

  it('el avance indeterminado se anima y reduce-motion lo detiene (3.4)', () => {
    expect(bloqueCss(css.barra, '.indeterminada')).toMatch(/animation:/);
    expect(css.barra).toMatch(/@keyframes\s+\S+/);
    const reducir = bloqueReducirMovimiento(css.barra);
    expect(reducir).toContain('.indeterminada');
    expect(reducir).toMatch(/animation:\s*none/);
  });

  it('la pista corta solo el relleno animado y tiene un ancho mínimo', () => {
    // Ningún contador ni texto vive dentro de la pista: lo que corta es el
    // relleno indeterminado al desplazarse dentro de su caja.
    expect(bloqueCss(css.barra, '.pista')).toMatch(/overflow:\s*hidden/);
    expect(bloqueCss(css.barra, '.pista')).toMatch(/min-inline-size:\s*\S+/);
  });

  it('la columna Avance reserva su ancho en la cabecera', () => {
    expect(bloqueCss(css.tabla, '.avance')).toMatch(/inline-size:\s*22%/);
  });

  it('el esqueleto usa el token de relleno de los esqueletos y el alto táctil', () => {
    expect(bloqueCss(css.esqueleto, '.barra')).toContain(
      'var(--color-hover-2)',
    );
    expect(bloqueCss(css.esqueleto, '.barra')).toContain('var(--touch-min)');
  });

  it('la tarjeta del historial usa superficie y borde por token', () => {
    const tarjeta = bloqueCss(css.historial, '.historial');
    expect(tarjeta).toContain('var(--color-surface)');
    expect(tarjeta).toContain('var(--color-border)');
  });
});
