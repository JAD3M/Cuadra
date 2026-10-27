import { type EntityManager, QueryFailedError } from 'typeorm';
import { type CfdiLeido, CfdiRechazado } from '../cfdi/cfdi-leido';
import { esMonedaNoSoportada, leerCfdi } from '../cfdi/lector-cfdi';
import type { MarcaDeMoneda, ResultadoDeArchivo } from './carga.entity';
import type { ResultadoDeProceso } from './resultado-de-proceso';

export const INDICE_UUID = 'ux_cfdi_company_id_uuid_fiscal';

export interface ArchivoEnEspera {
  nombre: string;
  /** NULL si el archivo traía bytes nulos (ver `CargaArchivo.contenido`). */
  contenido: string | null;
}

/**
 * Un archivo en su propio SAVEPOINT. Solo dos cosas son del archivo: lo que
 * rechaza el lector (error) y el UUID que ya está en la empresa (ya existía).
 * Cualquier otra excepción se relanza: es de infraestructura, y quien llama
 * decide (CU-08: el worker revierte todo y el job se reintenta).
 */
export async function guardarCfdi(
  manager: EntityManager,
  companyId: string,
  cargaId: string,
  { nombre, contenido }: ArchivoEnEspera,
): Promise<ResultadoDeArchivo> {
  if (contenido === null) {
    return {
      archivo: nombre,
      resultado: 'error',
      motivo: 'El archivo trae bytes nulos: no es XML válido',
    };
  }
  await manager.query('SAVEPOINT archivo');
  let cfdi: CfdiLeido | undefined;
  try {
    cfdi = leerCfdi(contenido);
    await manager.query(
      `INSERT INTO cfdi
         (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor,
          serie, folio, fecha_emision, tipo_comprobante, moneda,
          tipo_cambio, subtotal, descuento, total, metodo_pago,
          forma_pago, estado, xml_raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamp, $9, $10,
               $11, $12, $13, $14, $15, $16, $17, $18::jsonb)`,
      [
        companyId,
        cargaId,
        cfdi.uuidFiscal,
        cfdi.rfcEmisor,
        cfdi.rfcReceptor,
        cfdi.serie,
        cfdi.folio,
        // Texto directo a timestamp sin zona: pasar por Date lo movería a
        // la zona del servidor.
        cfdi.fechaEmision,
        cfdi.tipoComprobante,
        cfdi.moneda,
        cfdi.tipoCambio,
        cfdi.subtotal,
        cfdi.descuento,
        cfdi.total,
        cfdi.metodoPago,
        cfdi.formaPago,
        cfdi.estadoInicial,
        JSON.stringify(cfdi.xmlRaw),
      ],
    );
    await manager.query('RELEASE SAVEPOINT archivo');
    return { archivo: nombre, resultado: 'nuevo', ...marcaDeMoneda(cfdi) };
  } catch (error) {
    if (violaIndice(error, INDICE_UUID)) {
      // Sin esto, el 23505 deja la transacción abortada y todo lo que sigue
      // falla con "current transaction is aborted".
      await manager.query('ROLLBACK TO SAVEPOINT archivo');
      return {
        archivo: nombre,
        resultado: 'ya_existia',
        ...(cfdi ? marcaDeMoneda(cfdi) : {}),
      };
    }
    if (error instanceof CfdiRechazado) {
      await manager.query('ROLLBACK TO SAVEPOINT archivo');
      return { archivo: nombre, resultado: 'error', motivo: error.message };
    }
    throw error;
  }
}

/** Historia 3.1: la marca solo viaja cuando la moneda no es MXN ni XXX. */
function marcaDeMoneda({ moneda }: CfdiLeido): MarcaDeMoneda {
  return esMonedaNoSoportada(moneda) ? { monedaNoSoportada: true, moneda } : {};
}

export function violaIndice(error: unknown, indice: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const { code, constraint } = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return code === '23505' && constraint === indice;
}

/** CU-06 a CU-08: cada archivo del lote, en orden, dentro de la transacción (b). */
export async function procesarLoteCfdi(
  manager: EntityManager,
  companyId: string,
  cargaId: string,
): Promise<ResultadoDeProceso> {
  const archivos = await manager.query<ArchivoEnEspera[]>(
    `SELECT nombre, contenido FROM carga_archivos
      WHERE carga_id = $1 AND company_id = $2
      ORDER BY orden`,
    [cargaId, companyId],
  );
  const resultados: ResultadoDeArchivo[] = [];
  for (const archivo of archivos) {
    resultados.push(await guardarCfdi(manager, companyId, cargaId, archivo));
  }
  const cuenta = (r: ResultadoDeArchivo['resultado']) =>
    resultados.filter((x) => x.resultado === r).length;
  return {
    resultados,
    nuevos: cuenta('nuevo'),
    existentes: cuenta('ya_existia'),
    errores: cuenta('error'),
  };
}
