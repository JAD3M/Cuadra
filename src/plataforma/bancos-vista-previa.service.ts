import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BANCOS_PDF } from '../bancos/pdf/lectores-pdf';
import { BancoVistaPrevia } from './banco-vista-previa.entity';
import type { BancoPlataformaDto } from './dto/plataforma.dto';

/** Cargas aceptadas que un banco necesita para que se levante su vista previa. */
export const MINIMO_CARGAS_ACEPTADAS = 5;

/** SQLSTATE de `unique_violation`. */
const VIOLACION_UNICA = '23505';

/**
 * AD-2, AD-7, Historia 3.6. El dueño ve cuántas cargas aceptadas tiene cada
 * banco y levanta la vista previa obligatoria. El conteo es siempre por
 * consulta (`cargas_aceptadas_por_banco()`, que cruza empresas sin exponer
 * datos de ninguna); no hay contador guardado. Solo este módulo nombra
 * `bancos_vista_previa`: `cargas` pregunta con `estaLevantado`.
 */
@Injectable()
export class BancosVistaPrevia {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(BancoVistaPrevia)
    private readonly bancos: Repository<BancoVistaPrevia>,
  ) {}

  async listar(): Promise<BancoPlataformaDto[]> {
    const aceptadas = await this.aceptadasPorBanco(this.ds);
    const levantadas = new Map(
      (await this.bancos.find()).map((b) => [b.banco, b.levantadaEn]),
    );
    return BANCOS_PDF.map((banco) => {
      const levantadaEn = levantadas.get(banco);
      return {
        banco,
        aceptadas: aceptadas.get(banco) ?? 0,
        levantada: levantadaEn !== undefined,
        levantadaEn: levantadaEn ? levantadaEn.toISOString() : null,
      };
    });
  }

  /** ¿Ya se levantó la vista previa obligatoria de este banco? */
  async estaLevantado(banco: string): Promise<boolean> {
    return await this.bancos.exists({
      where: { banco: banco.trim().toLowerCase() },
    });
  }

  /**
   * Una sola transacción: el renglón y la bitácora de plataforma. Si
   * cualquiera falla no queda nada. El INSERT usa `ON CONFLICT DO NOTHING`:
   * dos peticiones a la vez no crean dos renglones ni dan 500, la que pierde
   * recibe 409.
   */
  async levantar(
    plataformaUsuarioId: string,
    bancoCrudo: string,
  ): Promise<BancoPlataformaDto> {
    const banco = bancoCrudo.trim().toLowerCase();
    if (!BANCOS_PDF.includes(banco)) {
      throw new NotFoundException(`El banco "${banco.slice(0, 32)}" no existe`);
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();

      const aceptadas = (await this.aceptadasPorBanco(qr)).get(banco) ?? 0;
      if (aceptadas < MINIMO_CARGAS_ACEPTADAS) {
        throw new UnprocessableEntityException(
          `El banco ${banco} tiene ${aceptadas} ${aceptadas === 1 ? 'carga aceptada' : 'cargas aceptadas'}; se necesitan al menos ${MINIMO_CARGAS_ACEPTADAS} para levantar la vista previa`,
        );
      }

      const insertadas = (await qr.query(
        `INSERT INTO bancos_vista_previa (banco, levantada_por)
         VALUES ($1, $2)
         ON CONFLICT (banco) DO NOTHING
         RETURNING levantada_en AS "levantadaEn"`,
        [banco, plataformaUsuarioId],
      )) as Array<{ levantadaEn: Date }>;
      if (insertadas.length === 0) throw yaLevantada(banco);

      await qr.query(
        `INSERT INTO bitacora_plataforma (plataforma_usuario_id, accion, detalle)
         VALUES ($1, 'levantar_vista_previa', $2::jsonb)`,
        [plataformaUsuarioId, JSON.stringify({ banco, aceptadas })],
      );

      await qr.commitTransaction();
      return {
        banco,
        aceptadas,
        levantada: true,
        levantadaEn: insertadas[0].levantadaEn.toISOString(),
      };
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      if (esViolacionUnica(error)) throw yaLevantada(banco);
      throw error;
    } finally {
      await qr.release();
    }
  }

  private async aceptadasPorBanco(
    origen: Pick<DataSource, 'query'>,
  ): Promise<Map<string, number>> {
    const filas: Array<{ banco: string; aceptadas: string }> =
      await origen.query(
        `SELECT banco, aceptadas FROM cargas_aceptadas_por_banco()`,
      );
    return new Map(filas.map((f) => [f.banco, Number(f.aceptadas)]));
  }
}

function yaLevantada(banco: string): ConflictException {
  return new ConflictException(
    `La vista previa del banco ${banco} ya está levantada`,
  );
}

function esViolacionUnica(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === VIOLACION_UNICA
  );
}
