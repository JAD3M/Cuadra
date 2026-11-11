import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { rolesConPermiso } from '../auth/permisos/matriz';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import type { ContextoDeCambio } from '../companies/tolerancia.service';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { RazonOmisionLote, Rol } from '../common/entities/tipos';
import {
  separacionActiva,
  subioAlgunaCarga,
} from '../common/separacion-funciones';
import { idsQueChocan } from './choques-de-lote';
import type {
  LoteRespuestaDto,
  ResolucionRespuestaDto,
} from './dto/resolucion.dto';

interface DecisionBloqueada {
  id: string;
  estado: string;
  movimientoId: string;
  cfdiIds: string[];
  diferenciaMonto: string | null;
  regla: string | null;
  score: string | null;
  motivo: string | null;
}

const UNIQUE_VIOLATION = '23505';

/** Motivo de las hermanas que se cierran solas al confirmar otra. */
export const MOTIVO_HERMANA = 'cerrada al confirmar otra conciliación';

/** Quién y desde dónde; `metodo` y `ruta` alimentan el rastro del 403. */
export interface ContextoDeConfirmacion extends ContextoDeCambio {
  metodo: string;
  ruta: string;
}

interface LadoBloqueado {
  estado: string;
  cargaId: string | null;
}

/**
 * Una propuesta que el lote deja fuera, con su razón (5.3). Solo se lanza en
 * modo lote: la confirmación de un caso sigue respondiendo 404, 409 o 403.
 */
class PropuestaOmitida extends Error {
  constructor(readonly razon: RazonOmisionLote) {
    super(razon);
  }
}

/**
 * CU-15. Resuelve una propuesta (`decisiones`, tipo 'conciliacion'). Todo corre
 * en la transacción de la petición (RLS como cuadra_app) y cada consulta
 * filtra `company_id` además. Orden de candados (AD-19), igual que
 * `conciliar()`: consultivo de la empresa -> decisiones por `id` ascendente
 * (la objetivo y sus hermanas juntas) -> CFDI -> movimiento.
 *
 * La transición es una sola sentencia con CTE que cambia la decisión, cierra
 * a las hermanas, el CFDI y el movimiento y escribe la bitácora (AD-7). Cada
 * UPDATE lleva su guarda de estado y aquí se verifica cuántas filas afectó:
 * si algo no afectó lo esperado, 409 y la transacción de la petición revierte.
 *
 * El motor propone; aquí solo una persona cierra o descarta.
 */
@Injectable()
export class ResolucionService {
  private readonly logger = new Logger(ResolucionService.name);

  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly conciliacion: ConciliacionService,
    private readonly accesosDenegados: AccesosDenegados,
  ) {}

  /**
   * Confirma una propuesta: cierra el CFDI ('conciliada') y el movimiento
   * ('conciliado') y pasa a 'obsoleta' las hermanas que quedan sin sentido.
   * Orden de comprobaciones: 404 -> 409 -> 403 (D-08: quien subió cualquiera
   * de las dos cargas no puede confirmar). Nada aquí llama a `conciliar`: no
   * se libera nada.
   */
  async confirmar(
    companyId: string,
    id: string,
    quien: ContextoDeConfirmacion,
  ): Promise<ResolucionRespuestaDto> {
    return this.confirmarUna(companyId, id, quien, null);
  }

  /**
   * Confirma un lote (5.3, FR-19, FR-31): cada propuesta marcada se confirma
   * con LA MISMA sentencia atómica de un caso, dentro de su propio SAVEPOINT; la
   * que no se puede (ya resuelta, CFDI o movimiento cerrados, separación de
   * funciones, un cambio concurrente) se omite con su razón y las demás siguen.
   * Todas las confirmadas comparten el `lote_id`. Orden de candados (AD-19):
   * consultivo de la empresa una sola vez y luego las decisiones por `id`
   * ascendente. Las marcadas que chocan entre sí (mismo movimiento o misma
   * factura) se omiten las dos: no se elige una al azar. Un error que no es una
   * omisión revierte el lote entero.
   */
  async confirmarLote(
    companyId: string,
    ids: readonly string[],
    quien: ContextoDeConfirmacion,
    desmarcadas: readonly string[] = [],
  ): Promise<LoteRespuestaDto> {
    const manager = this.contexto.manager();
    await tomarCandadoDeConciliacion(manager, companyId);
    // Defensa en profundidad: el DTO ya normaliza, pero aquí se compara contra los
    // ids que devuelve la base (siempre en minúsculas).
    const ordenados = [...new Set(ids.map((id) => id.toLowerCase()))].sort();
    const sinMarca = [...new Set(desmarcadas.map((id) => id.toLowerCase()))];
    if (sinMarca.some((id) => ordenados.includes(id))) {
      throw new BadRequestException(
        'Una propuesta no puede ir a la vez marcada y desmarcada',
      );
    }
    await this.anotarDesmarcadas(companyId, sinMarca, quien);
    // AD-13: una sola lectura de la configuración para todo el lote.
    const separacion = await separacionActiva(manager, companyId);
    const choques = await this.marcadasQueChocan(companyId, ordenados);
    const [{ id: loteId }] = await manager.query<{ id: string }[]>(
      'SELECT uuidv7() AS id',
    );

    const confirmadas: string[] = [];
    const omitidas: LoteRespuestaDto['omitidas'] = [];
    for (const id of ordenados) {
      if (choques.has(id)) {
        omitidas.push({ id, razon: 'choca_con_otra_del_lote' });
        continue;
      }
      await manager.query('SAVEPOINT item_de_lote');
      try {
        await this.confirmarUna(companyId, id, quien, loteId, separacion);
        await manager.query('RELEASE SAVEPOINT item_de_lote');
        confirmadas.push(id);
      } catch (error) {
        if (!(error instanceof PropuestaOmitida)) throw error;
        await manager.query('ROLLBACK TO SAVEPOINT item_de_lote');
        omitidas.push({ id, razon: error.razon });
      }
    }
    return {
      loteId: confirmadas.length > 0 ? loteId : null,
      confirmadas,
      omitidas,
    };
  }

  /** Las marcadas (aún propuestas) que comparten movimiento o factura entre sí. */
  private async marcadasQueChocan(
    companyId: string,
    ids: readonly string[],
  ): Promise<Set<string>> {
    const filas = await this.contexto
      .manager()
      .query<{ id: string; movimientoId: string; cfdiIds: string[] }[]>(
        `SELECT d.id, d.movimiento_id AS "movimientoId",
              COALESCE(array_agg(l.cfdi_id::text) FILTER (WHERE l.cfdi_id IS NOT NULL),
                       '{}'::text[]) AS "cfdiIds"
         FROM decisiones d
         LEFT JOIN decision_lineas l ON l.decision_id = d.id AND l.company_id = $1
        WHERE d.company_id = $1 AND d.id = ANY($2::uuid[])
          AND d.tipo = 'conciliacion' AND d.estado = 'propuesta'
        GROUP BY d.id`,
        [companyId, ids],
      );
    return idsQueChocan(filas);
  }

  /** Falla de un paso previo: omisión en un lote, la excepción HTTP en un caso. */
  private falla(
    enLote: boolean,
    razon: RazonOmisionLote,
    http: () => Error,
  ): Error {
    return enLote ? new PropuestaOmitida(razon) : http();
  }

  private async confirmarUna(
    companyId: string,
    id: string,
    quien: ContextoDeConfirmacion,
    loteId: string | null,
    separacion?: boolean,
  ): Promise<ResolucionRespuestaDto> {
    const enLote = loteId !== null;
    const manager = this.contexto.manager();
    const decision = await this.cargarPropuesta(companyId, id, true, enLote);
    const cfdiId = decision.cfdiIds[0];

    const cfdis = await manager.query<LadoBloqueado[]>(
      `SELECT estado, carga_id AS "cargaId" FROM cfdi
        WHERE id = ANY($1::uuid[]) AND company_id = $2
        ORDER BY id FOR UPDATE`,
      [decision.cfdiIds, companyId],
    );
    if (cfdis.length !== decision.cfdiIds.length) {
      throw this.falla(
        enLote,
        'cfdi_no_abierto',
        () => new ConflictException('El CFDI de la propuesta ya no existe'),
      );
    }
    const cerrado = cfdis.find((cfdi) => cfdi.estado !== 'abierta');
    if (cerrado) {
      throw this.falla(
        enLote,
        'cfdi_no_abierto',
        () =>
          new ConflictException(
            `El CFDI está '${cerrado.estado}': solo se confirma contra uno abierto`,
          ),
      );
    }
    const [movimiento] = await manager.query<LadoBloqueado[]>(
      `SELECT estado, carga_id AS "cargaId" FROM movimientos
        WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [decision.movimientoId, companyId],
    );
    if (!movimiento) {
      throw this.falla(
        enLote,
        'movimiento_no_abierto',
        () =>
          new ConflictException('El movimiento de la propuesta ya no existe'),
      );
    }
    if (movimiento.estado !== 'abierto') {
      throw this.falla(
        enLote,
        'movimiento_no_abierto',
        () =>
          new ConflictException(
            `El movimiento está '${movimiento.estado}': solo se confirma contra uno abierto`,
          ),
      );
    }

    if (
      await this.segregacionViolada(
        companyId,
        quien,
        cfdis,
        movimiento,
        separacion,
      )
    ) {
      // En un lote se omite en silencio (sin 403 ni rastro de acceso denegado):
      // la persona ya vio el motivo al armar el lote.
      if (enLote) throw new PropuestaOmitida('separacion_de_funciones');
      await this.rastroYDenegar(companyId, quien);
    }

    let resultado: {
      confirmadaAt: string | null;
      cfdis: number;
      movimientos: number;
      auditoria: number;
      hermanas: string[];
    };
    try {
      [resultado] = await manager.query<(typeof resultado)[]>(
        `WITH objetivo AS (
           UPDATE decisiones
              SET estado = 'confirmada', confirmada_por_id = $3,
                  confirmada_at = now(), lote_id = $10::uuid, updated_at = now()
            WHERE id = $2 AND company_id = $1 AND estado = 'propuesta'
           RETURNING id, confirmada_at, diferencia_monto, regla, score
         ),
         hermanas AS (
           UPDATE decisiones d
              SET estado = 'obsoleta', motivo = $6, updated_at = now()
            WHERE d.company_id = $1 AND d.id <> $2 AND d.estado = 'propuesta'
              AND EXISTS (SELECT 1 FROM objetivo)
              AND (d.movimiento_id = $4
                   OR EXISTS (SELECT 1 FROM decision_lineas l
                               WHERE l.decision_id = d.id AND l.company_id = $1
                                 AND l.cfdi_id = ANY($5::uuid[])))
           RETURNING d.id, d.movimiento_id,
                     (SELECT l.cfdi_id FROM decision_lineas l
                       WHERE l.decision_id = d.id AND l.company_id = $1
                       ORDER BY l.cfdi_id LIMIT 1) AS cfdi_id,
                     (SELECT array_agg(l.cfdi_id ORDER BY l.cfdi_id)
                        FROM decision_lineas l
                       WHERE l.decision_id = d.id AND l.company_id = $1) AS cfdi_ids
         ),
         cfdis AS (
           UPDATE cfdi SET estado = 'conciliada', updated_at = now()
            WHERE company_id = $1 AND id = ANY($5::uuid[]) AND estado = 'abierta'
              AND EXISTS (SELECT 1 FROM objetivo)
           RETURNING id
         ),
         movs AS (
           UPDATE movimientos
              SET estado = 'conciliado', motivo_sin_match = NULL,
                  regla_sin_match = NULL, evaluado_at = NULL, updated_at = now()
            WHERE company_id = $1 AND id = $4 AND estado = 'abierto'
              AND EXISTS (SELECT 1 FROM objetivo)
           RETURNING id
         ),
         auditoria AS (
           INSERT INTO bitacora
                  (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent)
           SELECT $1::uuid, $3::uuid, 'decisiones', o.id, 'confirmar',
                  jsonb_build_object(
                    'antes', jsonb_build_object('estado', 'propuesta'),
                    'despues', jsonb_build_object(
                      'estado', 'confirmada',
                      'confirmadaPorId', $3::uuid,
                      'confirmadaAt', to_char(o.confirmada_at AT TIME ZONE 'UTC',
                                              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
                    'cfdi', jsonb_build_object('id', $7::uuid,
                                               'antes', 'abierta', 'despues', 'conciliada'),
                    'cfdiIds', to_jsonb($5::uuid[]),
                    'movimiento', jsonb_build_object('id', $4::uuid,
                                                     'antes', 'abierto', 'despues', 'conciliado'),
                    'diferenciaMonto', o.diferencia_monto::text)
                  || jsonb_strip_nulls(jsonb_build_object(
                    'regla', o.regla, 'score', o.score::text,
                    'loteId', $10::uuid)),
                  $8::inet, $9
             FROM objetivo o
           UNION ALL
           SELECT $1::uuid, $3::uuid, 'decisiones', h.id, 'rechazar',
                  jsonb_build_object(
                    'antes', jsonb_build_object('estado', 'propuesta'),
                    'despues', jsonb_build_object('estado', 'obsoleta', 'motivo', $6::text),
                    'cfdiId', h.cfdi_id,
                    'cfdiIds', to_jsonb(h.cfdi_ids),
                    'movimientoId', h.movimiento_id,
                    'causa', jsonb_build_object('conciliacionId', $2::uuid)),
                  $8::inet, $9
             FROM hermanas h
           RETURNING id
         ),
         sombra AS (
           INSERT INTO evidencia_sombra (company_id, banco, decision_id, evento, persona_id)
           SELECT $1::uuid, m.banco, o.id, 'confirmo', $3::uuid
             FROM objetivo o
             JOIN evidencia_sombra h
               ON h.decision_id = o.id AND h.company_id = $1
              AND h.evento = 'habria_cerrado'
             JOIN movimientos m ON m.id = $4 AND m.company_id = $1
           RETURNING id
         )
         SELECT (SELECT to_char(confirmada_at AT TIME ZONE 'UTC',
                                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM objetivo) AS "confirmadaAt",
                (SELECT count(*) FROM cfdis)::int AS cfdis,
                (SELECT count(*) FROM movs)::int AS movimientos,
                (SELECT count(*) FROM auditoria)::int AS auditoria,
                COALESCE((SELECT array_agg(id::text ORDER BY id) FROM hermanas),
                         '{}'::text[]) AS hermanas`,
        [
          companyId,
          id,
          quien.userId,
          decision.movimientoId,
          decision.cfdiIds,
          MOTIVO_HERMANA,
          cfdiId,
          quien.ip ?? null,
          quien.userAgent ?? null,
          loteId,
        ],
      );
    } catch (error) {
      const traducido = this.traducir(error);
      throw enLote && traducido instanceof ConflictException
        ? new PropuestaOmitida('cambio_concurrente')
        : traducido;
    }

    // Cada UPDATE debe haber afectado exactamente lo esperado. Si no, 409: la
    // excepción revierte toda la transacción (decisión, hermanas y bitácora).
    if (
      resultado.confirmadaAt === null ||
      resultado.cfdis !== decision.cfdiIds.length ||
      resultado.movimientos !== 1 ||
      resultado.auditoria !== 1 + resultado.hermanas.length
    ) {
      throw this.falla(
        enLote,
        'cambio_concurrente',
        () =>
          new ConflictException(
            'La conciliación cambió mientras se confirmaba: no se aplicó nada',
          ),
      );
    }

    return {
      id,
      estado: 'confirmada',
      cfdiId,
      cfdiIds: decision.cfdiIds,
      movimientoId: decision.movimientoId,
      motivo: decision.motivo,
      confirmadaAt: resultado.confirmadaAt,
      rechazadasAutomaticamente: resultado.hermanas,
    };
  }

  /**
   * 6.2 (FR-35): anota `desmarco` por cada propuesta que la persona dejó sin
   * marcar en el lote. Solo cuenta la que sigue en `propuesta` y ya tenía
   * `habria_cerrado`; el resto (otra regla, ya resuelta, de otra empresa o
   * inexistente) se ignora sin error. No cambia el estado de nada.
   */
  private async anotarDesmarcadas(
    companyId: string,
    desmarcadas: readonly string[],
    quien: ContextoDeConfirmacion,
  ): Promise<void> {
    if (desmarcadas.length === 0) return;
    await this.contexto.manager().query(
      `INSERT INTO evidencia_sombra (company_id, banco, decision_id, evento, persona_id)
       SELECT $1::uuid, m.banco, d.id, 'desmarco', $3::uuid
         FROM decisiones d
         JOIN evidencia_sombra h
           ON h.decision_id = d.id AND h.company_id = $1
          AND h.evento = 'habria_cerrado'
         JOIN movimientos m ON m.id = d.movimiento_id AND m.company_id = $1
        WHERE d.company_id = $1 AND d.id = ANY($2::uuid[])
          AND d.estado = 'propuesta'`,
      [companyId, desmarcadas, quien.userId],
    );
  }

  /**
   * D-08: quien subió la carga del CFDI o la del movimiento no confirma su
   * propio trabajo. Sin carga (null) ese lado no restringe. La regla vive en
   * `separacion-funciones.ts` (la bandeja usa la misma) y aquí no lanza nada.
   */
  private async segregacionViolada(
    companyId: string,
    quien: ContextoDeConfirmacion,
    cfdis: LadoBloqueado[],
    movimiento: LadoBloqueado,
    separacion?: boolean,
  ): Promise<boolean> {
    const manager = this.contexto.manager();
    // AD-13: sin la separación activa (lectura falla cerrada) la regla no aplica.
    const activa = separacion ?? (await separacionActiva(manager, companyId));
    if (!activa) return false;
    return subioAlgunaCarga(manager, companyId, quien.userId, [
      ...cfdis.map((cfdi) => cfdi.cargaId),
      movimiento.cargaId,
    ]);
  }

  /**
   * El 403 de un caso suelto. Revierte la transacción de la petición, así que
   * el rastro del acceso denegado se escribe aparte.
   */
  private async rastroYDenegar(
    companyId: string,
    quien: ContextoDeConfirmacion,
  ): Promise<never> {
    const roles = await this.contexto
      .manager()
      .query<{ rol: Rol }[]>(
        `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
        [quien.userId, companyId],
      );
    await this.accesosDenegados.registrar({
      companyId,
      userId: quien.userId,
      metodo: quien.metodo,
      ruta: quien.ruta,
      rolesRequeridos: [...rolesConPermiso('conciliaciones.resolver')],
      rolesDelUsuario: roles.map((fila) => fila.rol),
      ip: quien.ip,
      userAgent: quien.userAgent,
    });
    throw new ForbiddenException(
      'Quien subió el CFDI o el estado de cuenta no puede confirmar esta conciliación',
    );
  }

  /**
   * Rechaza una propuesta. El movimiento sigue 'abierto' y el CFDI 'abierta'.
   * Un motivo omitido conserva el de la propuesta. Después del COMMIT, si el
   * rechazo liberó algún lado, corre `conciliar` una vez; si truena, se
   * registra y el rechazo sigue en pie.
   */
  async rechazar(
    companyId: string,
    id: string,
    motivo: string | undefined,
    quien: ContextoDeCambio,
  ): Promise<ResolucionRespuestaDto> {
    const manager = this.contexto.manager();
    const decision = await this.cargarPropuesta(companyId, id, false);
    const cfdiId = decision.cfdiIds[0];

    // Mismo orden que confirmar (AD-19): CFDI y luego movimiento.
    await manager.query(
      `SELECT 1 FROM cfdi WHERE id = ANY($1::uuid[]) AND company_id = $2
        ORDER BY id FOR UPDATE`,
      [decision.cfdiIds, companyId],
    );
    await manager.query(
      `SELECT 1 FROM movimientos WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [decision.movimientoId, companyId],
    );

    let filas: { motivo: string | null; auditoria: number }[];
    try {
      filas = await manager.query(
        `WITH rechazada AS (
           UPDATE decisiones
              SET estado = 'rechazada', motivo = COALESCE($3::text, motivo),
                  updated_at = now()
            WHERE id = $2 AND company_id = $1 AND estado = 'propuesta'
           RETURNING id, motivo, diferencia_monto
         ),
         auditoria AS (
           INSERT INTO bitacora
                  (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent)
           SELECT $1::uuid, $4::uuid, 'decisiones', r.id, 'rechazar',
                  jsonb_build_object(
                    'antes', jsonb_build_object('estado', 'propuesta',
                                                'motivo', $5::text),
                    'despues', jsonb_build_object('estado', 'rechazada',
                                                  'motivo', r.motivo),
                    'cfdiId', $6::uuid,
                    'cfdiIds', to_jsonb($10::uuid[]),
                    'movimientoId', $7::uuid,
                    'diferenciaMonto', r.diferencia_monto::text),
                  $8::inet, $9
             FROM rechazada r
           RETURNING id
         ),
         sombra AS (
           INSERT INTO evidencia_sombra (company_id, banco, decision_id, evento, persona_id)
           SELECT $1::uuid, m.banco, r.id, 'rechazo', $4::uuid
             FROM rechazada r
             JOIN evidencia_sombra h
               ON h.decision_id = r.id AND h.company_id = $1
              AND h.evento = 'habria_cerrado'
             JOIN movimientos m ON m.id = $7 AND m.company_id = $1
           RETURNING id
         )
         SELECT r.motivo, (SELECT count(*) FROM auditoria)::int AS auditoria
           FROM rechazada r`,
        [
          companyId,
          id,
          motivo ?? null,
          quien.userId,
          decision.motivo,
          cfdiId,
          decision.movimientoId,
          quien.ip ?? null,
          quien.userAgent ?? null,
          decision.cfdiIds,
        ],
      );
    } catch (error) {
      throw this.traducir(error);
    }
    if (filas.length !== 1 || filas[0].auditoria !== 1) {
      throw new ConflictException(
        'La conciliación cambió mientras se rechazaba: no se aplicó nada',
      );
    }
    const motivoFinal = filas[0].motivo;

    if (await this.liberoAlgunLado(companyId, id, decision)) {
      this.contexto.alConfirmar(async () => {
        try {
          await this.conciliacion.conciliar(companyId);
        } catch (error) {
          this.logger.error(
            `Empresa ${companyId}: conciliar falló tras rechazar ${id}; el rechazo ya quedó confirmado`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      });
    }

    return {
      id,
      estado: 'rechazada',
      cfdiId,
      cfdiIds: decision.cfdiIds,
      movimientoId: decision.movimientoId,
      motivo: motivoFinal,
      confirmadaAt: null,
      rechazadasAutomaticamente: [],
    };
  }

  /**
   * Candado de empresa y luego las decisiones FOR UPDATE por `id` ascendente:
   * la objetivo y, al confirmar, también sus hermanas (mismo movimiento o
   * mismo CFDI, en 'propuesta'). Inexistente y ajena dan el mismo 404 (RLS y
   * `company_id` la esconden igual). Solo una 'propuesta' puede transicionar.
   */
  private async cargarPropuesta(
    companyId: string,
    id: string,
    conHermanas: boolean,
    enLote = false,
  ): Promise<DecisionBloqueada> {
    const manager = this.contexto.manager();
    await tomarCandadoDeConciliacion(manager, companyId);
    await manager.query(
      `SELECT d.id FROM decisiones d
        WHERE d.company_id = $1
          AND (d.id = $2
               OR ($3::boolean AND d.estado = 'propuesta'
                   AND (d.movimiento_id = (SELECT x.movimiento_id FROM decisiones x
                                            WHERE x.id = $2 AND x.company_id = $1)
                        OR EXISTS (SELECT 1 FROM decision_lineas l
                                    WHERE l.decision_id = d.id AND l.company_id = $1
                                      AND l.cfdi_id IN (SELECT y.cfdi_id FROM decision_lineas y
                                                         WHERE y.decision_id = $2
                                                           AND y.company_id = $1)))))
        ORDER BY d.id
          FOR UPDATE OF d`,
      [companyId, id, conHermanas],
    );
    const filas = await manager.query<DecisionBloqueada[]>(
      `SELECT d.id, d.estado, d.movimiento_id AS "movimientoId",
              d.diferencia_monto::text AS "diferenciaMonto", d.regla,
              d.score::text AS score, d.motivo,
              COALESCE((SELECT array_agg(l.cfdi_id::text ORDER BY l.cfdi_id)
                          FROM decision_lineas l
                         WHERE l.decision_id = d.id AND l.company_id = $1),
                       '{}'::text[]) AS "cfdiIds"
         FROM decisiones d
        WHERE d.id = $2 AND d.company_id = $1 AND d.tipo = 'conciliacion'`,
      [companyId, id],
    );
    if (filas.length === 0) {
      throw this.falla(
        enLote,
        'no_existe',
        () => new NotFoundException('Conciliación no encontrada'),
      );
    }
    if (filas[0].estado !== 'propuesta') {
      throw this.falla(
        enLote,
        'ya_resuelta',
        () =>
          new ConflictException(
            `La conciliación ya está '${filas[0].estado}': solo una propuesta se puede resolver`,
          ),
      );
    }
    if (filas[0].cfdiIds.length === 0) {
      throw this.falla(
        enLote,
        'cfdi_no_abierto',
        () => new ConflictException('La propuesta no tiene CFDI asociado'),
      );
    }
    return filas[0];
  }

  /**
   * Libre = el movimiento o algún CFDI quedaron sin otra decisión viva
   * (propuesta o confirmada): el motor puede volver a proponerles algo.
   */
  private async liberoAlgunLado(
    companyId: string,
    id: string,
    decision: DecisionBloqueada,
  ): Promise<boolean> {
    const [{ libre }] = await this.contexto
      .manager()
      .query<{ libre: boolean }[]>(
        `SELECT (
         NOT EXISTS (SELECT 1 FROM decisiones
                      WHERE company_id = $1 AND id <> $2 AND movimiento_id = $3
                        AND estado IN ('propuesta', 'confirmada'))
         OR EXISTS (SELECT 1 FROM unnest($4::uuid[]) AS c(cfdi_id)
                     WHERE NOT EXISTS (SELECT 1 FROM decision_lineas l
                                         JOIN decisiones d ON d.id = l.decision_id
                                        WHERE l.company_id = $1 AND l.cfdi_id = c.cfdi_id
                                          AND d.id <> $2
                                          AND d.estado IN ('propuesta', 'confirmada')))
       ) AS libre`,
        [companyId, id, decision.movimientoId, decision.cfdiIds],
      );
    return libre;
  }

  /** Defensa en profundidad: bajo el candado no debería ocurrir. */
  private traducir(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return new ConflictException(
        'La conciliación choca con otra ya confirmada',
      );
    }
    return error;
  }
}
