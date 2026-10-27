import { readFileSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { Cfdi } from './cfdi.entity';
import { CfdiRechazado, type MotivoRechazoCfdi } from './cfdi-leido';
import {
  DIGITOS_CFDI,
  esMonedaNoSoportada,
  LARGOS_CFDI,
  leerCfdi,
} from './lector-cfdi';

/**
 * CU-05. Todos los XML son sintéticos (src/cfdi/fixtures): RFCs del seed,
 * UUIDs inventados y sellos de relleno. Nunca datos reales.
 */

function fixture(nombre: string): string {
  return readFileSync(join(__dirname, 'fixtures', nombre), 'utf8');
}

function rechazo(xml: string): CfdiRechazado {
  try {
    leerCfdi(xml);
  } catch (error) {
    if (error instanceof CfdiRechazado) return error;
    throw error;
  }
  throw new Error('Se esperaba un rechazo y el CFDI se aceptó');
}

describe('lector de CFDI 4.0 (CU-05)', () => {
  describe('acepta', () => {
    it('PUE en MXN: extrae los campos de la tabla cfdi', () => {
      const cfdi = leerCfdi(fixture('pue-valido.xml'));

      expect(cfdi).toMatchObject({
        uuidFiscal: '5E2D6AFF-2DD7-43D1-83D3-14C1ACA396D9',
        rfcEmisor: 'FDB190215QK4',
        rfcReceptor: 'TCU170830R52',
        tipoComprobante: 'I',
        moneda: 'MXN',
        tipoCambio: null,
        subtotal: '3850.50',
        descuento: '0',
        total: '4466.58',
        metodoPago: 'PUE',
        formaPago: '03',
        serie: 'A',
        folio: '1001',
        impuestos: {
          trasladados: '616.08',
          retenidos: '0',
          localesTrasladados: '0',
          localesRetenidos: '0',
        },
        estadoInicial: 'abierta',
      });
    });

    it('PPD: estado inicial distinto de PUE, con retenciones', () => {
      const cfdi = leerCfdi(fixture('ppd-valido.xml'));

      expect(cfdi.metodoPago).toBe('PPD');
      expect(cfdi.estadoInicial).toBe('parcialidades');
      expect(cfdi.impuestos).toMatchObject({
        trasladados: '1920.00',
        retenidos: '1200.00',
      });
      expect(cfdi.total).toBe('12720.00');
    });

    it('con descuento: el del comprobante es la suma de los conceptos', () => {
      const cfdi = leerCfdi(fixture('con-descuento.xml'));

      expect(cfdi).toMatchObject({
        subtotal: '6200.00',
        descuento: '500.00',
        total: '6612.00',
      });
    });

    it('USD: conserva el tipo de cambio con sus 6 decimales', () => {
      const cfdi = leerCfdi(fixture('usd-tipo-cambio.xml'));

      expect(cfdi.moneda).toBe('USD');
      expect(cfdi.tipoCambio).toBe('17.234567');
    });

    // Historia 3.1: ya no hay lista de monedas; cualquier código bien formado
    // entra y la marca "moneda no soportada" se deriva (no MXN ni XXX).
    it.each(['EUR', 'CHF', 'JPY', 'CAD'])(
      '%s: se acepta y queda marcada como moneda no soportada',
      (moneda) => {
        const xml = fixture('usd-tipo-cambio.xml').replace(
          'Moneda="USD"',
          `Moneda="${moneda}"`,
        );

        const cfdi = leerCfdi(xml);

        expect(cfdi.moneda).toBe(moneda);
        expect(esMonedaNoSoportada(cfdi.moneda)).toBe(true);
      },
    );

    it('USD queda marcada; MXN y XXX no', () => {
      expect(
        esMonedaNoSoportada(leerCfdi(fixture('usd-tipo-cambio.xml')).moneda),
      ).toBe(true);
      expect(
        esMonedaNoSoportada(leerCfdi(fixture('pue-valido.xml')).moneda),
      ).toBe(false);
      expect(esMonedaNoSoportada('XXX')).toBe(false);
    });

    it('Importes de 6 decimales que cuadran solo al redondear a centavos', () => {
      // 3 × 333.333333 = 999.999999: sin redondear, no sería 1000.00.
      const cfdi = leerCfdi(fixture('importe-6-decimales.xml'));

      expect(cfdi.subtotal).toBe('1000.00');
      expect(cfdi.total).toBe('1160.00');
    });

    it('suma al total los impuestos locales del complemento', () => {
      const cfdi = leerCfdi(fixture('impuestos-locales.xml'));

      expect(cfdi.impuestos).toEqual({
        trasladados: '1600.00',
        retenidos: '0',
        localesTrasladados: '200.00',
        localesRetenidos: '0.00',
      });
      expect(cfdi.total).toBe('11800.00');
    });
  });

  describe('conserva el dato tal como viene', () => {
    it('la fecha sin zona y sin convertir a UTC', () => {
      expect(leerCfdi(fixture('pue-valido.xml')).fechaEmision).toBe(
        '2026-09-15T10:30:00',
      );
    });

    it('los montos como texto, nunca como number', () => {
      const cfdi = leerCfdi(fixture('usd-tipo-cambio.xml'));
      for (const valor of [
        cfdi.subtotal,
        cfdi.descuento,
        cfdi.total,
        cfdi.tipoCambio,
        cfdi.impuestos.trasladados,
        cfdi.impuestos.retenidos,
        cfdi.impuestos.localesTrasladados,
        cfdi.impuestos.localesRetenidos,
      ]) {
        expect(typeof valor).toBe('string');
      }
    });

    it('el XML original íntegro bajo _xml, byte por byte', () => {
      const xml = fixture('pue-valido.xml');
      const { xmlRaw } = leerCfdi(xml);

      expect(xmlRaw._xml).toBe(xml);
      // ck_cfdi_xml_raw_integro: objeto con la llave _xml.
      expect(JSON.parse(JSON.stringify(xmlRaw))).toHaveProperty('_xml', xml);
      expect(xmlRaw).toHaveProperty('Comprobante');
    });

    it('un solo concepto también se lee como lista', () => {
      // ppd-valido trae un único Concepto: sin isArray vendría como objeto
      // y la suma de Importes daría cero.
      expect(() => leerCfdi(fixture('ppd-valido.xml'))).not.toThrow();
    });
  });

  describe('rechaza con el motivo', () => {
    const casos: Array<[string, MotivoRechazoCfdi, RegExp]> = [
      ['rechazo-version-33.xml', 'version', /3\.3.*4\.0/],
      ['rechazo-rfc-invalido.xml', 'rfc_emisor', /FDB190215\b/],
      ['rechazo-sin-uuid.xml', 'uuid_ausente', /UUID/],
      [
        'rechazo-subtotal-no-cuadra.xml',
        'subtotal_no_cuadra',
        /declara 3850\.00.*da 3850\.50/,
      ],
      [
        'rechazo-descuento-no-cuadra.xml',
        'descuento_no_cuadra',
        /declara 400\.00.*da 500\.00/,
      ],
      [
        'rechazo-total-no-cuadra.xml',
        'total_no_cuadra',
        /declara 4466\.59.*da 4466\.58/,
      ],
    ];

    it.each(casos)('%s → %s', (archivo, motivo, mensaje) => {
      const error = rechazo(fixture(archivo));

      expect(error.motivo).toBe(motivo);
      expect(error.message).toMatch(mensaje);
    });

    it.each(['usd', 'US', 'USDX', '12A', 'U$D'])(
      'Moneda mal formada (%s) → campo_invalido',
      (moneda) => {
        const xml = fixture('usd-tipo-cambio.xml').replace(
          'Moneda="USD"',
          `Moneda="${moneda}"`,
        );
        const error = rechazo(xml);

        expect(error.motivo).toBe('campo_invalido');
        expect(error.message).toMatch(/Moneda/);
      },
    );

    it('sin Moneda → campo_invalido', () => {
      const xml = fixture('usd-tipo-cambio.xml').replace(' Moneda="USD"', '');

      expect(rechazo(xml).motivo).toBe('campo_invalido');
    });

    it('XML mal formado', () => {
      expect(rechazo('<cfdi:Comprobante Version="4.0">').motivo).toBe(
        'xml_mal_formado',
      );
    });

    it('XML con DOCTYPE, antes de expandir entidades', () => {
      const xml = fixture('pue-valido.xml').replace(
        '<cfdi:Comprobante',
        '<!DOCTYPE x [<!ENTITY a "aaaa">]>\n<cfdi:Comprobante',
      );
      expect(rechazo(xml).motivo).toBe('xml_mal_formado');
    });

    it('un monto con notación científica no se cuela como número', () => {
      const xml = fixture('pue-valido.xml').replace(
        'Total="4466.58"',
        'Total="4.46658e3"',
      );
      expect(rechazo(xml).motivo).toBe('campo_invalido');
    });
  });

  describe('límites de largo (Anexo 20 y columnas de cfdi)', () => {
    const pue = () => fixture('pue-valido.xml');

    it('Serie de 25 entra; de 26 se rechaza con motivo', () => {
      expect(
        leerCfdi(pue().replace('Serie="A"', `Serie="${'S'.repeat(25)}"`)).serie,
      ).toHaveLength(25);

      const error = rechazo(
        pue().replace('Serie="A"', `Serie="${'S'.repeat(26)}"`),
      );
      expect(error.motivo).toBe('campo_fuera_de_limite');
      expect(error.message).toMatch(
        /serie tiene 26 caracteres; el máximo es 25/,
      );
    });

    it('cuenta caracteres, no bytes: 25 Ñ entran', () => {
      // 25 caracteres, 50 bytes en UTF-8. varchar(25) cuenta caracteres.
      expect(
        leerCfdi(pue().replace('Serie="A"', `Serie="${'Ñ'.repeat(25)}"`)).serie,
      ).toBe('Ñ'.repeat(25));
    });

    it('Folio de 41 se rechaza', () => {
      const error = rechazo(
        pue().replace('Folio="1001"', `Folio="${'9'.repeat(41)}"`),
      );
      expect(error.motivo).toBe('campo_fuera_de_limite');
      expect(error.message).toMatch(/folio/);
    });

    it('un Total con 5 decimales no se deja redondear callado por NUMERIC(18,4)', () => {
      // Cuadra al redondear a centavos, pero la columna perdería el quinto decimal.
      const error = rechazo(
        pue().replace('Total="4466.58"', 'Total="4466.58001"'),
      );
      expect(error.motivo).toBe('campo_fuera_de_limite');
      expect(error.message).toMatch(/total = 4466\.58001/);
    });

    it('un tipo de cambio con 13 enteros no cabe en NUMERIC(18,6)', () => {
      const error = rechazo(
        fixture('usd-tipo-cambio.xml').replace(
          'TipoCambio="17.234567"',
          `TipoCambio="${'1'.repeat(13)}.5"`,
        ),
      );
      expect(error.motivo).toBe('campo_fuera_de_limite');
      expect(error.message).toMatch(/tipoCambio/);
    });

    // Si alguien achica una columna sin tocar el lector, esto se pone rojo
    // antes de que llegue un 22001 a producción.
    it('ningún límite del lector pasa del de su columna en la entidad', () => {
      const columnas = new Map(
        getMetadataArgsStorage()
          .columns.filter((c) => c.target === Cfdi)
          .map((c) => [c.propertyName, c.options]),
      );

      for (const [campo, largo] of Object.entries(LARGOS_CFDI)) {
        const columna = columnas.get(campo);
        // Sin columna, Number(undefined) es NaN y el <= fallaría igual, pero
        // con un mensaje que no dice qué campo.
        expect([campo, columna?.length]).not.toEqual([campo, undefined]);
        expect(largo).toBeLessThanOrEqual(Number(columna?.length));
      }
      for (const [campo, { enteros, decimales }] of Object.entries(
        DIGITOS_CFDI,
      )) {
        const columna = columnas.get(campo);
        expect([campo, columna?.scale]).not.toEqual([campo, undefined]);
        const escala = Number(columna?.scale);
        const precision = Number(columna?.precision);
        expect(decimales).toBeLessThanOrEqual(escala);
        expect(enteros).toBeLessThanOrEqual(precision - escala);
      }
    });
  });
});
