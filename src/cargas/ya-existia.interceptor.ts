import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import type { RespuestaDeCarga } from './cargas.service';

/**
 * CU-07: un lote que ya se había cargado responde 200, no 202: no se creó
 * nada. Va aquí y no con `@Res()` en el handler, que apagaría los
 * interceptores. Nest fija el código del `@HttpCode` al entrar la petición y
 * no lo vuelve a poner al responder, así que cambiarlo después del handler
 * se respeta; el test del 200 lo vigila si eso cambia.
 */
@Injectable()
export class YaExistiaInterceptor implements NestInterceptor {
  intercept(
    contexto: ExecutionContext,
    next: CallHandler<RespuestaDeCarga>,
  ): Observable<RespuestaDeCarga> {
    return next.handle().pipe(
      map((respuesta) => {
        if (respuesta.yaExistia) {
          contexto.switchToHttp().getResponse<Response>().status(HttpStatus.OK);
        }
        return respuesta;
      }),
    );
  }
}
