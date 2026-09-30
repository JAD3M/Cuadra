// src/sugerencias/sugerencias.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Dinero } from '../common/dinero';
import type { ParExistente, ReglaAmbigua } from '../conciliacion/evaluar-par';
import { ProveedorTolerancia } from '../conciliacion/tolerancia';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import {
  type CfdiSugerible,
  construirSolicitud,
  type MovimientoSugerible,
  type SolicitudSugerencia,
} from './candidatos';
import { PersistenciaSugerencias } from './persistencia-sugerencias';
import { ProveedorSugerencia } from './proveedor-sugerencia';
import { validarRespuesta } from './validar-sugerencia';

/** Las únicas razones por las que un movimiento es elegible (IA-01). */
export const REGLAS_ELEGIBLES: readonly ReglaAmbigua[] = [
  'referencia_ambigua',
  'monto_multiples_candidatos',
  'cfdi_multiples_movimientos',
];

export interface OpcionesSugerencias {
  /** Tope de llamadas al proveedor por corrida (LLM_MAX_LLAMADAS_POR_CORRIDA). */
  maxLlamadas: number;
  /** Más candidatos que esto: no se pregunta (LLM_CANDIDATOS_MAX). */
  maxCandidatos: number;
}

export const OPCIONES_SUGERENCIAS = 'OPCIONES_SUGERENCIAS';

export const OPCIONES_POR_OMISION: OpcionesSugerencias = {
  maxLlamadas: 20,
  maxCandidatos: 10,
};

export interface ResumenDeCorrida {
  /** Movimientos elegibles leídos. */
  elegibles: number;
  /** Sin candidatos, con demasiados, o ya preguntados con la misma entrada. */
  omitidos: number;
  /** Llamadas al proveedor. */
  llamadas: number;
  propuestas: number;
  sinSugerencia: number;
  /** La respuesta llegó tarde: el estado cambió y no se escribió nada. */
  obsoletas: number;
  /** El proveedor falló y la corrida se detuvo. */
  interrumpida: boolean;
}

const VACIO: ResumenDeCorrida = {
  elegibles: 0,
  omitidos: 0,
  llamadas: 0,
  propuestas: 0,
  sinSugerencia: 0,
  obsoletas: 0,
  interrumpida: false,
};

interface Lectura {
  movimientos: MovimientoSugerible[];
  cfdis: CfdiSugerible[];
  existentes: ParExistente[];
  hashes: Map<string, Set<string>>;
  tolerancia: Dinero;
}

/**
 * CU-17. Pide al modelo una sugerencia para los movimientos que el motor dejó
 * sin propuesta por ambigüedad. El motor decide; el modelo solo elige entre
 * los candidatos que el motor ya considera compatibles, y su resultado es una
 * propuesta que una persona confirma o rechaza (CU-15): nunca cierra un caso.
 *
 * Tres tiempos: (1) lee en una transacción corta y sin candado; (2) llama al
 * proveedor SIN transacción ni candado abiertos, una vez por movimiento y en
 * serie; (3) escribe cada resultado en su propia transacción corta, que
 * revalida todo bajo el candado. Un fallo del proveedor corta la corrida sin
 * escribir nada de esa llamada; el siguiente intento lo reintenta. Un fallo de
 * base de datos se propaga.
 */
@Injectable()
export class SugerenciasService {
  private readonly logger = new Logger(SugerenciasService.name);

  constructor(
    private readonly transaccion: TransaccionEmpresa,
    private readonly tolerancia: ProveedorTolerancia,
    private readonly proveedor: ProveedorSugerencia,
    private readonly persistencia: PersistenciaSugerencias,
    @Inject(OPCIONES_SUGERENCIAS)
    private readonly opciones: OpcionesSugerencias,
  ) {}

  async sugerirParaEmpresa(companyId: string): Promise<ResumenDeCorrida> {
    // Apagado: ni se lee la base.
    if (!this.proveedor.activo) return { ...VACIO };

    const lectura = await this.leer(companyId);
    if (!lectura) return { ...VACIO };

    const resumen: ResumenDeCorrida = {
      ...VACIO,
      elegibles: lectura.movimientos.length,
    };
    const pendientes: SolicitudSugerencia[] = [];
    for (const movimiento of lectura.movimientos) {
      const construccion = construirSolicitud({
        movimiento,
        cfdis: lectura.cfdis,
        existentes: lectura.existentes,
        tolerancia: lectura.tolerancia,
        modelo: this.proveedor.modelo,
        maxCandidatos: this.opciones.maxCandidatos,
      });
      if (
        construccion.tipo === 'omitida' ||
        lectura.hashes.get(movimiento.id)?.has(construccion.solicitud.inputHash)
      ) {
        resumen.omitidos++;
        continue;
      }
      pendientes.push(construccion.solicitud);
    }

    // Lo omitido no cuenta para el tope: solo lo que de verdad se pregunta.
    for (const solicitud of pendientes.slice(0, this.opciones.maxLlamadas)) {
      resumen.llamadas++;
      let respuesta: unknown;
      try {
        respuesta = await this.proveedor.sugerir(solicitud.entrada);
      } catch (error) {
        this.cortar(companyId, resumen, 'falló el proveedor', error);
        break;
      }

      const decision = validarRespuesta(respuesta, solicitud);
      if (decision.tipo === 'error') {
        this.cortar(companyId, resumen, decision.detalle);
        break;
      }
      if (decision.tipo === 'sin_sugerencia') {
        await this.persistencia.registrarSinSugerencia(companyId, solicitud);
        resumen.sinSugerencia++;
        continue;
      }
      const resultado = await this.persistencia.proponer(companyId, {
        solicitud,
        cfdiId: decision.cfdiId,
        confianza: decision.confianza,
        motivo: decision.motivo,
        modelo: this.proveedor.modelo,
      });
      if (resultado === 'creada') resumen.propuestas++;
      else resumen.obsoletas++;
    }

    this.logger.log(
      `Empresa ${companyId}: ${resumen.elegibles} elegible(s), ${resumen.omitidos} omitido(s), ` +
        `${resumen.llamadas} llamada(s), ${resumen.propuestas} propuesta(s), ` +
        `${resumen.sinSugerencia} sin sugerencia, ${resumen.obsoletas} obsoleta(s)` +
        (resumen.interrumpida ? ', corrida interrumpida' : ''),
    );
    return resumen;
  }

  private cortar(
    companyId: string,
    resumen: ResumenDeCorrida,
    detalle: string,
    error?: unknown,
  ): void {
    resumen.interrumpida = true;
    this.logger.warn(
      `Empresa ${companyId}: corrida de sugerencias interrumpida (${detalle}); nada quedó escrito de esa llamada` +
        (error instanceof Error ? `: ${error.message}` : ''),
    );
  }

  /**
   * Transacción de solo lectura y sin candado: el proveedor es lento y la
   * empresa no puede esperar a que conteste para conciliar.
   */
  private async leer(companyId: string): Promise<Lectura | null> {
    const tolerancia = await this.tolerancia.obtener(companyId);
    return this.transaccion.ejecutar(companyId, async (manager) => {
      const empresas = await manager.query<{ rfc: string }[]>(
        `SELECT rfc FROM companies WHERE id = $1`,
        [companyId],
      );
      if (empresas.length === 0) return null;

      const movimientos = await manager.query<MovimientoSugerible[]>(
        `SELECT m.id, to_char(m.fecha, 'YYYY-MM-DD') AS fecha, m.monto::text AS monto,
                m.moneda, m.descripcion, m.referencia,
                m.referencia_norm AS "referenciaNorm",
                m.regla_sin_match AS regla, m.motivo_sin_match AS motivo
           FROM movimientos m
          WHERE m.company_id = $1 AND m.estado = 'abierto' AND m.monto > 0
            AND m.regla_sin_match = ANY($2::text[])
            AND NOT EXISTS (SELECT 1 FROM conciliaciones c
                             WHERE c.company_id = $1 AND c.movimiento_id = m.id
                               AND c.estado <> 'rechazada')
          ORDER BY m.fecha, m.id`,
        [companyId, REGLAS_ELEGIBLES],
      );
      if (movimientos.length === 0) return null;

      const cfdis = await manager.query<CfdiSugerible[]>(
        `SELECT id, serie, folio,
                to_char(fecha_emision, 'YYYY-MM-DD') AS "fechaEmision",
                total::text AS total, moneda, nombre_receptor AS receptor
           FROM cfdi
          WHERE company_id = $1 AND estado = 'abierta'
            AND tipo_comprobante = 'I' AND rfc_emisor = $2`,
        [companyId, empresas[0].rfc],
      );
      const existentes = await manager.query<ParExistente[]>(
        `SELECT cfdi_id AS "cfdiId", movimiento_id AS "movimientoId",
                (estado = 'rechazada') AS rechazada
           FROM conciliaciones WHERE company_id = $1`,
        [companyId],
      );
      const vistos = await manager.query<
        { movimientoId: string; inputHash: string }[]
      >(
        `SELECT movimiento_id AS "movimientoId", input_hash AS "inputHash"
           FROM sugerencias_ia
          WHERE company_id = $1 AND movimiento_id = ANY($2::uuid[])`,
        [companyId, movimientos.map((m) => m.id)],
      );
      const hashes = new Map<string, Set<string>>();
      for (const { movimientoId, inputHash } of vistos) {
        const conjunto = hashes.get(movimientoId) ?? new Set<string>();
        conjunto.add(inputHash);
        hashes.set(movimientoId, conjunto);
      }
      return { movimientos, cfdis, existentes, hashes, tolerancia };
    });
  }
}
