import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { normalizarRfc, validarRfc } from '../common/rfc';
import type {
  CambiarSeparacionDto,
  CrearEmpresaDto,
  EmpresaPlataformaDto,
} from './dto/plataforma.dto';

/** SQLSTATE de `unique_violation`. */
const VIOLACION_UNICA = '23505';

/**
 * AD-2, AD-7. Alta y lista de empresas por el dueño. `companies` está fuera
 * de RLS; `cuadra_app` solo puede insertar `rfc` y `razon_social`, así que el
 * INSERT es SQL explícito: TypeORM emitiría columnas sin GRANT.
 */
@Injectable()
export class EmpresasPlataforma {
  constructor(private readonly ds: DataSource) {}

  async listar(): Promise<EmpresaPlataformaDto[]> {
    return await this.ds.query(
      `SELECT id, razon_social AS "razonSocial", rfc,
              separacion_funciones AS "separacionFunciones"
         FROM companies
        ORDER BY razon_social, rfc`,
    );
  }

  /**
   * Una sola transacción: empresa, bitácora de la empresa y bitácora de
   * plataforma. Si cualquiera falla, no queda nada. Aquí la bitácora de
   * plataforma lanza (no pasa por `RegistroPlataforma.registrar`, que traga
   * el error): una empresa sin su rastro no debe existir.
   */
  async crear(
    dto: CrearEmpresaDto,
    plataformaUsuarioId: string,
  ): Promise<EmpresaPlataformaDto> {
    const rfc = normalizarRfc(dto.rfc);
    const validacion = validarRfc(rfc);
    if (!validacion.valido) throw new BadRequestException(validacion.mensaje);

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();

      const existente = (await qr.query(
        `SELECT id FROM companies WHERE rfc = $1`,
        [rfc],
      )) as Array<{ id: string }>;
      if (existente.length > 0) throw rfcDuplicado(rfc);

      const [empresa] = (await qr.query(
        `INSERT INTO companies (rfc, razon_social) VALUES ($1, $2) RETURNING id`,
        [rfc, dto.razonSocial],
      )) as Array<{ id: string }>;
      // La id nace en el INSERT: la empresa se fija después, local a la
      // transacción, para que la política de `bitacora` deje escribir.
      await qr.query(`SELECT set_config('app.company_id', $1, true)`, [
        empresa.id,
      ]);
      await qr.query(
        `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
         VALUES ($1, NULL, 'companies', $1, 'crear', $2::jsonb)`,
        [
          empresa.id,
          JSON.stringify({
            plataformaUsuarioId,
            rfc,
            razonSocial: dto.razonSocial,
          }),
        ],
      );
      await qr.query(
        `INSERT INTO bitacora_plataforma (plataforma_usuario_id, accion, company_id, detalle)
         VALUES ($1, 'crear_empresa', $2, $3::jsonb)`,
        [
          plataformaUsuarioId,
          empresa.id,
          JSON.stringify({ rfc, razonSocial: dto.razonSocial }),
        ],
      );

      await qr.commitTransaction();
      return {
        id: empresa.id,
        razonSocial: dto.razonSocial,
        rfc,
        separacionFunciones: true,
      };
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      // Otra petición ganó la carrera entre el pre-chequeo y el INSERT.
      if (esViolacionUnica(error)) throw rfcDuplicado(rfc);
      throw error;
    } finally {
      await qr.release();
    }
  }

  /**
   * AD-13, AD-5, AD-7. Apaga o vuelve a prender la separación de funciones de
   * UNA empresa. Una sola transacción: el cambio, la bitácora de la empresa y
   * la de plataforma; si cualquiera falla no queda nada (la de plataforma
   * lanza). Apagar y volver a prender es la misma acción: el sentido va en
   * `antes/despues`. `companies` no tiene RLS: el UPDATE filtra por id.
   */
  async cambiarSeparacion(
    empresaId: string,
    dto: CambiarSeparacionDto,
    plataformaUsuarioId: string,
  ): Promise<EmpresaPlataformaDto> {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();

      const [empresa] = (await qr.query(
        `SELECT razon_social AS "razonSocial", rfc,
                separacion_funciones AS "separacionFunciones"
           FROM companies WHERE id = $1 FOR UPDATE`,
        [empresaId],
      )) as Array<{
        razonSocial: string;
        rfc: string;
        separacionFunciones: boolean;
      }>;
      if (!empresa) throw new NotFoundException('La empresa no existe');
      if (empresa.separacionFunciones === dto.activa) {
        throw new ConflictException(
          `La separación de funciones ya estaba ${dto.activa ? 'activa' : 'desactivada'}`,
        );
      }

      await qr.query(
        `UPDATE companies SET separacion_funciones = $2 WHERE id = $1`,
        [empresaId, dto.activa],
      );
      await qr.query(`SELECT set_config('app.company_id', $1, true)`, [
        empresaId,
      ]);
      const cambio = {
        motivo: dto.motivo,
        antes: empresa.separacionFunciones,
        despues: dto.activa,
      };
      await qr.query(
        `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
         VALUES ($1, NULL, 'companies', $1, 'desactivar_separacion', $2::jsonb)`,
        [empresaId, JSON.stringify({ plataformaUsuarioId, ...cambio })],
      );
      await qr.query(
        `INSERT INTO bitacora_plataforma (plataforma_usuario_id, accion, company_id, detalle)
         VALUES ($1, 'desactivar_separacion', $2, $3::jsonb)`,
        [plataformaUsuarioId, empresaId, JSON.stringify(cambio)],
      );

      await qr.commitTransaction();
      return {
        id: empresaId,
        razonSocial: empresa.razonSocial,
        rfc: empresa.rfc,
        separacionFunciones: dto.activa,
      };
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}

function rfcDuplicado(rfc: string): ConflictException {
  return new ConflictException(`El RFC ${rfc} ya pertenece a otra empresa`);
}

function esViolacionUnica(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === VIOLACION_UNICA
  );
}
