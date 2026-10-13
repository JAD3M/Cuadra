import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { defer, lastValueFrom, type Observable } from 'rxjs';
import type { SolicitudAutenticada } from '../common/decorators/decoradores';
import { ContextoEmpresa } from './contexto-empresa';
import { TransaccionEmpresa } from './transaccion-empresa';

/**
 * Global. Corre después de los guards, así que `request.user` ya está
 * validado. Solo la sesión con empresa abre transacción de empresa:
 * `@Publico` no trae usuario y la sesión sin empresa elegida no trae empresa.
 */
@Injectable()
export class TransaccionEmpresaInterceptor implements NestInterceptor {
  constructor(
    private readonly transaccion: TransaccionEmpresa,
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
    const alConfirmar: Array<() => Promise<void>> = [];
    const resultado: unknown = await this.transaccion.ejecutar(
      companyId,
      (manager) =>
        // La suscripción (lastValueFrom) queda dentro del run, no solo la
        // llamada a handle(). Nest 11.2 hoy enlaza el contexto ya en
        // handle() (AsyncResource.bind), pero eso es un detalle interno: si
        // cambia, el handler correría fuera del run y ContextoEmpresa daría
        // 500.
        this.contexto.ejecutar({ manager, alConfirmar }, () =>
          lastValueFrom(next.handle(), { defaultValue: undefined }),
        ),
    );
    // Ya hubo COMMIT: ejecutar() lanza antes si algo falló.
    for (const accion of alConfirmar) await accion();
    return resultado;
  }
}
