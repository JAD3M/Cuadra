import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  clasificarConHuella,
  contarClases,
} from '../bancos/clasificar-huellas';
import { Bitacora } from '../bitacora/bitacora.entity';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { ContextoEmpresa } from '../database/contexto-empresa';
import { ColaSugerencias } from '../sugerencias/cola-sugerencias';
import type {
  AceptacionDto,
  RechazoDto,
  VistaPreviaDto,
} from './dto/vista-previa.dto';

/** Quién y desde dónde, para la bitácora. */
export interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

interface FilaCargaEnEspera {
  nombre_archivo: string;
  banco: string | null;
  total_registros: number;
  saldo_inicial: string | null;
  saldo_final: string | null;
}

interface FilaMovimiento {
  fecha: string;
  monto: string;
  referencia: string | null;
}

interface FilaEnEspera extends FilaMovimiento {
  linea_numero: number;
  cuenta: string | null;
}

interface FilaCargaBloqueada {
  estado: string;
  nombre_archivo: string;
  total_registros: number;
}

/**
 * Historia 3.4 (FR-3, parte): la vista previa de un PDF que cuadró y espera
 * en `movimientos_pendientes`. Aquí viven leerla (T2), aceptarla (T3) y
 * rechazarla (T4). Todo corre en la transacción de la petición, con RLS; el
 * filtro por empresa va igual en cada consulta (CLAUDE.md).
 */
@Injectable()
export class VistaPreviaService {
  private readonly logger = new Logger(VistaPreviaService.name);

  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly conciliacion: ConciliacionService,
    private readonly sugerencias: ColaSugerencias,
  ) {}

  /**
   * Solo lectura. 404 si la carga no existe, es de otra empresa o no está en
   * 'pendiente_vista_previa': para quien pregunta, no hay vista previa. Los
   * montos salen como texto de NUMERIC, nunca por flotante.
   */
  async consultar(companyId: string, cargaId: string): Promise<VistaPreviaDto> {
    const manager = this.contexto.manager();
    const [carga] = await manager.query<FilaCargaEnEspera[]>(
      `SELECT nombre_archivo, banco, total_registros,
              saldo_inicial::text AS saldo_inicial,
              saldo_final::text AS saldo_final
         FROM cargas
        WHERE id = $1 AND company_id = $2
          AND estado = 'pendiente_vista_previa'`,
      [cargaId, companyId],
    );
    if (!carga) throw new NotFoundException();
    const enEspera = await this.leerEnEspera(manager, companyId, cargaId);
    // Informativo y sin candado: aceptar vuelve a clasificar dentro de él.
    const resumen = contarClases(
      (await clasificarConHuella(manager, companyId, enEspera)).map(
        (f) => f.clase,
      ),
    );
    const movimientos: FilaMovimiento[] = enEspera.map(
      ({ fecha, monto, referencia }) => ({ fecha, monto, referencia }),
    );
    return {
      cargaId,
      archivo: carga.nombre_archivo,
      banco: carga.banco,
      total: movimientos.length,
      saldoInicial: carga.saldo_inicial,
      saldoFinal: carga.saldo_final,
      resumen,
      movimientos,
    };
  }

  /**
   * T3. Pasa los movimientos en espera a `movimientos` en una sola
   * transacción (la de la petición): candado de empresa (AD-19), carga
   * bloqueada, INSERT … SELECT, espera vaciada, carga 'procesada' con
   * contadores que cuadran (`ck_cargas_total_cuadra`) y bitácora. Si algo
   * lanza, todo se revierte: nada queda a medias. La conciliación y las
   * sugerencias arrancan después del COMMIT y nunca hacen fallar la respuesta.
   *
   * 404 si la carga no existe o es de otra empresa; 409 si no está en
   * 'pendiente_vista_previa' (también la segunda aceptación: el candado
   * serializa, así que la perdedora ya la ve procesada).
   */
  async aceptar(
    companyId: string,
    cargaId: string,
    actor: Actor,
  ): Promise<AceptacionDto> {
    const manager = this.contexto.manager();
    // Primero el candado, antes de cualquier fila: el mismo orden que usan
    // `conciliar()` y la resolución, para que no haya deadlock.
    await tomarCandadoDeConciliacion(manager, companyId);
    const carga = await this.bloquearEnEspera(manager, companyId, cargaId);

    // Historia 3.5: dentro del candado se clasifica contra `movimientos` (en
    // cualquier estado). Exactos se omiten; nuevos entran abiertos y dudosos
    // como `pendiente_revision`, todos con su huella.
    const enEspera = await this.leerEnEspera(manager, companyId, cargaId);
    // La espera se fijó con el total al guardar el PDF: si no coincide,
    // algo está mal y es mejor revertir que importar a medias.
    if (enEspera.length !== carga.total_registros) {
      throw new Error(
        `Carga ${cargaId}: en espera ${enEspera.length} movimientos y el total es ${carga.total_registros}`,
      );
    }
    const clasificadas = await clasificarConHuella(
      manager,
      companyId,
      enEspera,
    );
    const { nuevos, existentes, dudosos } = contarClases(
      clasificadas.map((f) => f.clase),
    );
    const aImportar = enEspera
      .map((fila, i) => ({ fila, ...clasificadas[i] }))
      .filter((f) => f.clase !== 'exacto');
    if (aImportar.length > 0) {
      await manager.query(
        `INSERT INTO movimientos
           (company_id, carga_id, linea_numero, fecha, descripcion,
            referencia, monto, moneda, banco, cuenta, estado, huella)
         SELECT p.company_id, p.carga_id, p.linea_numero, p.fecha,
                p.descripcion, p.referencia, p.monto, p.moneda, p.banco,
                p.cuenta, v.estado, v.huella
           FROM movimientos_pendientes p
           JOIN unnest($3::int[], $4::text[], $5::text[])
                AS v(linea_numero, estado, huella)
             ON v.linea_numero = p.linea_numero
          WHERE p.carga_id = $1 AND p.company_id = $2`,
        [
          cargaId,
          companyId,
          aImportar.map((f) => f.fila.linea_numero),
          aImportar.map((f) =>
            f.clase === 'dudoso' ? 'pendiente_revision' : 'abierto',
          ),
          aImportar.map((f) => f.huella),
        ],
      );
    }
    const n = nuevos + dudosos;
    await manager.query(
      `DELETE FROM movimientos_pendientes
        WHERE carga_id = $1 AND company_id = $2`,
      [cargaId, companyId],
    );
    await manager.query(
      `UPDATE cargas
          SET estado = 'procesada', registros_ok = $3,
              registros_existentes = $4,
              procesada_at = now(), updated_at = now()
        WHERE id = $1 AND company_id = $2`,
      [cargaId, companyId, n, existentes],
    );
    await manager.insert(Bitacora, {
      companyId,
      userId: actor.userId,
      entidad: 'cargas',
      entidadId: cargaId,
      accion: 'confirmar',
      datos: {
        cargaId,
        archivo: carga.nombre_archivo,
        estado: 'procesada',
        movimientos: n,
        nuevos,
        existentes,
        dudosos,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    // Sin nuevos no hay nada que conciliar (los dudosos quedan fuera).
    if (nuevos > 0) {
      this.contexto.alConfirmar(() => this.arrancarConciliacion(companyId));
    }
    return {
      cargaId,
      estado: 'procesada',
      movimientos: n,
      nuevos,
      existentes,
      dudosos,
    };
  }

  /**
   * T4. Descarta la vista previa: la espera se borra y la carga queda
   * 'rechazada'. Nada entra a `movimientos` ni a conciliación, así que no
   * toma el candado de empresa; el `FOR UPDATE` de la carga la serializa con
   * una aceptación simultánea (la perdedora ve otro estado y recibe 409).
   * 404 si no existe o es ajena; 409 si no está en espera.
   */
  async rechazar(
    companyId: string,
    cargaId: string,
    actor: Actor,
  ): Promise<RechazoDto> {
    const manager = this.contexto.manager();
    const carga = await this.bloquearEnEspera(manager, companyId, cargaId);
    const [{ n }] = await manager.query<[{ n: number }]>(
      `WITH borradas AS (
         DELETE FROM movimientos_pendientes
          WHERE carga_id = $1 AND company_id = $2
          RETURNING 1)
       SELECT count(*)::int AS n FROM borradas`,
      [cargaId, companyId],
    );
    await manager.query(
      `UPDATE cargas SET estado = 'rechazada', updated_at = now()
        WHERE id = $1 AND company_id = $2`,
      [cargaId, companyId],
    );
    await manager.insert(Bitacora, {
      companyId,
      userId: actor.userId,
      entidad: 'cargas',
      entidadId: cargaId,
      accion: 'rechazar',
      datos: {
        cargaId,
        archivo: carga.nombre_archivo,
        estado: 'rechazada',
        movimientosDescartados: n,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    return { cargaId, estado: 'rechazada' };
  }

  /** Las filas en espera de la carga, en orden de línea; monto como texto. */
  private leerEnEspera(
    manager: EntityManager,
    companyId: string,
    cargaId: string,
  ): Promise<FilaEnEspera[]> {
    return manager.query<FilaEnEspera[]>(
      `SELECT linea_numero, to_char(fecha, 'YYYY-MM-DD') AS fecha,
              monto::text AS monto, referencia, cuenta
         FROM movimientos_pendientes
        WHERE carga_id = $1 AND company_id = $2
        ORDER BY linea_numero`,
      [cargaId, companyId],
    );
  }

  /**
   * La carga con `FOR UPDATE`, que debe estar en espera. Con el candado de
   * empresa ya tomado, dos peticiones sobre la misma carga se turnan.
   */
  private async bloquearEnEspera(
    manager: EntityManager,
    companyId: string,
    cargaId: string,
  ): Promise<FilaCargaBloqueada> {
    const [carga] = await manager.query<FilaCargaBloqueada[]>(
      `SELECT estado, nombre_archivo, total_registros FROM cargas
        WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [cargaId, companyId],
    );
    if (!carga) throw new NotFoundException();
    if (carga.estado !== 'pendiente_vista_previa') {
      throw new ConflictException(
        'La carga ya no está en vista previa: ya se aceptó o se rechazó.',
      );
    }
    return carga;
  }

  /** Igual que el worker de cargas: solo loguea, la carga ya terminó. */
  private async arrancarConciliacion(companyId: string): Promise<void> {
    try {
      await this.conciliacion.conciliar(companyId);
    } catch (error) {
      this.logger.error(
        `Empresa ${companyId}: la conciliación automática falló tras aceptar una vista previa`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    if (!this.sugerencias.activa) return;
    try {
      await this.sugerencias.encolar(companyId);
    } catch (error) {
      this.logger.error(
        `Empresa ${companyId}: no se pudo encolar la sugerencia por IA tras aceptar una vista previa`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
