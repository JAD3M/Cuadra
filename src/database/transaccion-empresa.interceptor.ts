import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { defer, lastValueFrom, type Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import type { SolicitudAutenticada } from '../common/decorators/decoradores';
import { ContextoEmpresa } from './contexto-empresa';

/**
 * Global. Corre después de los guards, así que `request.user` ya está
 * validado. Solo el token de sesión abre transacción de empresa: `@Publico`
 * no trae usuario y el de selección no trae empresa.
 */
@Injectable()
export class TransaccionEmpresaInterceptor implements NestInterceptor {
  constructor(
    private readonly ds: DataSource,
    private readonly contexto: ContextoEmpresa,
  ) {}

  intercept(
    contexto: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const { user } = contexto
      .switchToHttp()
      .getRequest<Partial<SolicitudAutenticada>>();
    if (user?.scope !== 'sesion') return next.handle();

    const companyId = user.companyId;
    return defer(() => this.enTransaccion(companyId, next));
  }

  private async enTransaccion(
    companyId: string,
    next: CallHandler,
  ): Promise<unknown> {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      // Parametrizado y local a la transacción: al COMMIT o ROLLBACK se
      // borra solo, y la conexión vuelve al pool sin empresa.
      await qr.query(`SELECT set_config('app.company_id', $1, true)`, [
        companyId,
      ]);
      // La suscripción (lastValueFrom) queda dentro del run, no solo la
      // llamada a handle(). Nest 11.2 hoy enlaza el contexto ya en handle()
      // (AsyncResource.bind), pero eso es un detalle interno: si cambia,
      // el handler correría fuera del run y ContextoEmpresa daría 500.
      const resultado: unknown = await this.contexto.ejecutar(qr.manager, () =>
        lastValueFrom(next.handle(), { defaultValue: undefined }),
      );
      await qr.commitTransaction();
      return resultado;
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
