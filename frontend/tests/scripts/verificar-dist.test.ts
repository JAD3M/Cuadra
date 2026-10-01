// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verificarDist } from '../../scripts/verificar-dist.mjs';

const SCRIPT = path.resolve(
  import.meta.dirname,
  '../../scripts/verificar-dist.mjs',
);

let dist: string;

function escribir(relativa: string, contenido: string | Buffer) {
  const ruta = path.join(dist, relativa);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, contenido);
}

beforeEach(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'verificar-dist-'));
});

afterEach(() => {
  fs.rmSync(dist, { recursive: true, force: true });
});

describe('verificarDist', () => {
  it('pasa con una salida limpia', () => {
    escribir(
      'index.html',
      '<!doctype html><script src="/assets/a.js"></script>',
    );
    escribir('assets/a.js', 'console.log("Bandeja")');
    escribir('assets/a.css', '@font-face{src:url(/assets/f.woff2)}');
    expect(verificarDist(dist)).toEqual([]);
  });

  it('falla si aparece el marcador de la galería', () => {
    escribir('assets/a.js', 'rutas.push({path:"/__kit"})');
    const problemas = verificarDist(dist);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('__kit');
    expect(problemas[0]).toContain('a.js');
  });

  it('falla si aparece un texto de la galería', () => {
    escribir('assets/a.js', 'h1("Galería de componentes")');
    expect(verificarDist(dist).join('\n')).toContain('Galería de componentes');
  });

  it('falla si hay una referencia a Google Fonts', () => {
    escribir('assets/a.css', '@import url(https://fonts.googleapis.com/css2)');
    expect(verificarDist(dist).join('\n')).toContain('fonts.googleapis');
  });

  it('falla si hay una referencia a gstatic', () => {
    escribir('index.html', '<link href="https://fonts.gstatic.com">');
    expect(verificarDist(dist).join('\n')).toContain('gstatic');
  });

  it('revisa subcarpetas e informa cada archivo', () => {
    escribir('assets/a.js', '__kit');
    escribir('assets/profundo/b.js', '__kit');
    expect(verificarDist(dist)).toHaveLength(2);
  });

  it('no inspecciona binarios', () => {
    escribir('assets/f.woff2', Buffer.from('__kit gstatic'));
    expect(verificarDist(dist)).toEqual([]);
  });

  it('lanza si la carpeta no existe', () => {
    expect(() => verificarDist(path.join(dist, 'nada'))).toThrow(
      /npm run build/,
    );
  });
});

describe('línea de comandos', () => {
  it('sale con 0 sobre una salida limpia', () => {
    escribir('index.html', '<!doctype html>');
    const salida = execFileSync('node', [SCRIPT, dist], { encoding: 'utf8' });
    expect(salida).toContain('limpio');
  });

  it('sale con 1 y lista el problema', () => {
    escribir('assets/a.js', '__kit');
    const resultado = spawnSync('node', [SCRIPT, dist], { encoding: 'utf8' });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain('__kit');
  });

  it('sale con 1 si no hay carpeta', () => {
    const resultado = spawnSync('node', [SCRIPT, path.join(dist, 'nada')], {
      encoding: 'utf8',
    });
    expect(resultado.status).toBe(1);
  });
});
