import supertest from 'supertest';
import type { App } from 'supertest/types';

/**
 * `supertest` que manda el `Origin` autorizado en toda petición que cambia
 * datos (AD-6). Es lo que hace un navegador en el mismo origen; sin él, el
 * guard de origen rechazaría cada POST, PUT, PATCH y DELETE de los specs.
 *
 * Un caso que pruebe otro origen lo pisa con `.set('Origin', ...)`, y uno
 * que pruebe su ausencia usa `.unset('Origin')`. Los GET no llevan `Origin`:
 * los navegadores tampoco lo mandan en las lecturas del mismo origen.
 */
function request(app: App) {
  const base = supertest(app);
  const origen = () => process.env.ORIGEN_AUTORIZADO as string;
  return {
    get: (url: string) => base.get(url),
    head: (url: string) => base.head(url),
    options: (url: string) => base.options(url),
    post: (url: string) => base.post(url).set('Origin', origen()),
    put: (url: string) => base.put(url).set('Origin', origen()),
    patch: (url: string) => base.patch(url).set('Origin', origen()),
    delete: (url: string) => base.delete(url).set('Origin', origen()),
  };
}

// Los specs usan `request.Test` y `request.Response` como tipos.
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace request {
  export type Test = supertest.Test;
  export type Response = supertest.Response;
}

export default request;
