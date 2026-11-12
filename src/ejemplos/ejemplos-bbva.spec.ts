import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { extraerTextoPdf } from '../bancos/pdf/extraer-texto-pdf';
import { leerEstadoCuentaBbva } from '../bancos/pdf/lector-bbva';
import { cuadrarSaldos } from '../bancos/cuadre-saldos';
import { leerCfdi } from '../cfdi/lector-cfdi';
import { leerCsvDemo } from '../demo/ayudas-demo';
import { RFC_RECEPTORES } from '../../scripts/demo/escenarios';
import { RFC_EMPRESA, RFC_PAC } from '../../scripts/demo/formatos';
import {
  CARPETA,
  CSV_EQUIVALENTE,
  generarEjemplos,
  MANIFIESTO,
  nombreDeCfdi,
  ORIGENES_PERMITIDOS,
  PDF_CUADRA,
  PDF_NO_CUADRA,
} from '../../scripts/ejemplos/generar';
import {
  DIFERENCIA_NO_CUADRA,
  FACTURAS,
  MOVIMIENTOS,
  saldoFinal,
} from '../../scripts/ejemplos/juego';

/**
 * Historia 7.1 (FR-70, insumos). El juego de ejemplo de BBVA: todo sintético,
 * el PDF se lee con el lector real y coincide con su CSV equivalente.
 */

const UUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g;
const RAIZ = join(__dirname, '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta));

const pdf = async (ruta: string) =>
  leerEstadoCuentaBbva(await extraerTextoPdf(leer(ruta)));

/** Todos los archivos bajo `ejemplos/`, con ruta relativa a la raíz del repo. */
function archivosEnDisco(dir = join(RAIZ, 'ejemplos')): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory()
      ? archivosEnDisco(ruta)
      : [relative(RAIZ, ruta)];
  });
}

describe('ejemplos de BBVA: el PDF que cuadra (S1, S5)', () => {
  it('se lee con el lector real: saldos y movimientos esperados, sin líneas sin leer', async () => {
    const leido = await pdf(PDF_CUADRA);

    expect(leido.saldoInicial).toBe('10000.00');
    expect(leido.saldoFinal).toBe(saldoFinal());
    expect(leido.saldoFinal).toBe('18650.00');
    expect(leido.movimientos).toHaveLength(MOVIMIENTOS.length);
    expect(leido.movimientos).toHaveLength(8);
    expect(leido.movimientos.map((m) => m.monto)).toEqual(
      MOVIMIENTOS.map((m) => m.monto),
    );
    expect(leido.lineasNoLeidas).toEqual([]);
  });

  it('el cuadre común confirma que sus saldos cuadran', async () => {
    const leido = await pdf(PDF_CUADRA);
    expect(
      cuadrarSaldos({
        saldoInicial: leido.saldoInicial,
        saldoFinal: leido.saldoFinal,
        montos: leido.movimientos.map((m) => m.monto),
      }),
    ).toEqual({ cuadra: true });
  });
});

describe('ejemplos de BBVA: el PDF que no cuadra (S3)', () => {
  it('el lector lo lee, pero el cuadre detecta la diferencia exacta', async () => {
    const leido = await pdf(PDF_NO_CUADRA);

    expect(leido.movimientos).toHaveLength(8);
    const resultado = cuadrarSaldos({
      saldoInicial: leido.saldoInicial,
      saldoFinal: leido.saldoFinal,
      montos: leido.movimientos.map((m) => m.monto),
    });
    if (resultado.cuadra) throw new Error('el PDF debía no cuadrar');
    // La diferencia es la que se le sumó al saldo final, ni más ni menos.
    expect(Number(resultado.diferencia)).toBe(Number(DIFERENCIA_NO_CUADRA));
    expect(Number(resultado.saldoEsperado)).toBe(Number(saldoFinal()));
  });
});

describe('ejemplos de BBVA: CSV equivalente y CFDI (S1)', () => {
  it('el CSV trae los mismos movimientos que el PDF, con fecha, descripción, referencia y monto', async () => {
    const delPdf = (await pdf(PDF_CUADRA)).movimientos;
    const delCsv = leerCsvDemo(leer(CSV_EQUIVALENTE).toString('utf8'));

    expect(delCsv).toHaveLength(delPdf.length);
    expect(
      delCsv.map((f) => [f.fecha, f.descripcion, f.referencia, f.monto]),
    ).toEqual(
      delPdf.map((m) => [m.fecha, m.descripcion, m.referencia, m.monto]),
    );
  });

  it('los CFDI son del mismo mes y traen la cancelada y la de dólares', () => {
    const leidos = FACTURAS.map((f) =>
      leerCfdi(leer(nombreDeCfdi(f.folio)).toString('utf8')),
    );

    expect(leidos).toHaveLength(9);
    for (const c of leidos) {
      expect(c.rfcEmisor).toBe(RFC_EMPRESA.fdb);
      expect(c.serie).toBe('A');
    }
    const porFolio = new Map(leidos.map((c) => [c.folio, c]));
    expect(porFolio.get('5008')?.cancelado).toBe(true);
    expect(leidos.filter((c) => c.cancelado)).toHaveLength(1);
    expect(porFolio.get('5009')?.moneda).toBe('USD');
    expect(porFolio.get('5001')?.total).toBe('1160.00');
  });
});

describe('ejemplos de BBVA: sin datos reales (S2)', () => {
  it('todo RFC está en la lista cerrada de la demo', () => {
    const permitidos = new Set([
      ...Object.values(RFC_EMPRESA),
      RFC_PAC,
      ...RFC_RECEPTORES,
    ]);
    for (const ruta of archivosEnDisco()) {
      if (ruta.endsWith('.md')) continue;
      const crudos = leer(ruta)
        .toString('latin1')
        .match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}\b/g);
      for (const rfc of crudos ?? []) expect(permitidos.has(rfc)).toBe(true);
    }
  });

  it('ninguna cadena larga de dígitos (cuenta, CLABE) ni correos o teléfonos', async () => {
    const textos: string[] = [];
    for (const ruta of archivosEnDisco()) {
      if (ruta.endsWith('.md')) continue;
      // En un PDF se mira el texto extraído: su tabla de bytes lleva números largos.
      textos.push(
        ruta.endsWith('.pdf')
          ? await extraerTextoPdf(leer(ruta))
          : leer(ruta).toString('latin1'),
      );
    }
    for (const bruto of textos) {
      // El UUID del timbre es inventado (derivado de un hash), no un dato real.
      const texto = bruto.replace(UUID, '');
      expect(texto).not.toMatch(/\d{10,}/);
      expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });

  it('cada PDF y cada XML se declara sintético en su propio contenido', () => {
    for (const ruta of archivosEnDisco()) {
      const texto = leer(ruta).toString('latin1');
      if (ruta.endsWith('.pdf')) expect(texto).toContain('SINTETICO');
      if (ruta.endsWith('.xml')) expect(texto).toContain('SINTETICO');
    }
  });
});

describe('ejemplos de BBVA: lo commiteado es lo generado', () => {
  it('cada archivo generado existe igual en disco', () => {
    for (const [ruta, contenido] of generarEjemplos()) {
      expect(leer(ruta).equals(Buffer.from(contenido))).toBe(true);
    }
  });
});

describe('ejemplos: guarda contra archivos reales (S6)', () => {
  const manifiesto = JSON.parse(leer(MANIFIESTO).toString('utf8')) as {
    archivos: { ruta: string; origen: string }[];
  };
  /** Los únicos archivos que pueden estar en `ejemplos/` sin ser datos. */
  const TEXTOS = [
    'ejemplos/MANIFIESTO.json',
    'ejemplos/COMO-ANONIMIZAR.md',
    'ejemplos/LEEME.md',
  ];

  it('todo archivo de datos está en el manifiesto con origen sintético o público', () => {
    const declarados = new Map(
      manifiesto.archivos.map((a) => [`ejemplos/${a.ruta}`, a.origen]),
    );
    for (const ruta of archivosEnDisco().filter((r) => !TEXTOS.includes(r))) {
      expect(declarados.has(ruta)).toBe(true);
      expect(ORIGENES_PERMITIDOS as readonly string[]).toContain(
        declarados.get(ruta),
      );
    }
    for (const ruta of declarados.keys()) {
      expect(archivosEnDisco()).toContain(ruta);
    }
  });

  it('ningún archivo se llama «real» ni está marcado como real', () => {
    for (const ruta of archivosEnDisco()) {
      expect(ruta.toLowerCase()).not.toMatch(/(^|[/._-])real([/._-]|$)/);
    }
    for (const a of manifiesto.archivos) {
      expect(a.origen).not.toBe('real');
    }
  });

  it('.gitignore deja fuera ejemplos/real/ y *.real.*', () => {
    const gitignore = readFileSync(join(RAIZ, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\/?ejemplos\/real\/?$/m);
    expect(gitignore).toMatch(/^\*\.real\.\*$/m);
  });

  it('la carpeta de los ejemplos es la que declara el generador', () => {
    expect(CARPETA).toBe('ejemplos/bbva');
  });
});
