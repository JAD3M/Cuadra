# v2-1-1 · Sesión con cookie que el servidor puede cancelar

Rama: `feat/v2-1-1-sesiones-con-cookie`
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 1.1, FR-59, AD-2, AD-6). Jira: KAN-116 (ver `jira-mapping.md`).

## Objetivo

Reemplazar el JWT de dos tokens de la v1 (D-09) por una fila en `sesiones` con cookie `httpOnly`, `Secure`, `SameSite=Lax`. La persona sigue dentro al recargar, la sesión vence a las 8 h sin actividad y cerrar sesión la cancela de inmediato.

## Alcance autorizado

- Backend: `src/auth/**`, `src/database/**` (migración, entidad, interceptor), `src/config/**`, `src/main.ts`, tests y helpers que usan Bearer, `scripts/demo/runner.ts`.
- Frontend: `frontend/src/shared/sesion/**`, `frontend/src/shared/api/**`, `frontend/src/features/auth/**`, mocks y tests.
- Docs: `CUADRA.md` (D-09 retirada), `docs/bitacora.md`.
- Fuera de alcance: comprobación de `Origin` y límite de peticiones (historia 1.2), tipo `plataforma` y pantalla del dueño (1.3).

## Decisiones tomadas por evidencia

- Una sola cookie que rota al elegir empresa (AD-6); el flujo de dos pasos se conserva con `company_id` nulo hasta elegir.
- `sesiones` es clase 2 (AD-2): sin RLS; la lee el guard fuera de la transacción de empresa. Es la única tabla, con `invitaciones`, `tokens_recuperacion` y `user_company_roles`, que gana `DELETE`; en esta historia solo `sesiones`.
- Los roles se siguen leyendo de la base en cada petición.
- `Secure` se mantiene siempre; `localhost` lo acepta sobre HTTP y dev usa el proxy de Vite (mismo origen).

## Reglas no negociables que aplican

- La migración trae tabla, GRANTs explícitos para `cuadra_app` y el test de privilegios en la misma entrega.
- Ninguna query del dominio sin `company_id`; `sesiones` es identidad, no dominio.

## Tareas

| ID | Tarea | Ruta | Estado |
|----|-------|------|--------|
| T1 | Migración + entidad `sesiones`, GRANTs, test de privilegios (solo `sesiones` gana DELETE), `esquema.spec` | delegada | [x] `27905cc` |
| T2 | Servicio de sesiones, guard por cookie, endpoints login/empresa/logout/contexto, inactividad 8 h y renovación; migra a cookie los tests y helpers de backend que usaban Bearer (la suite queda en verde en el commit) | delegada | [x] `dcb2cef` |
| T3 | Limpieza del JWT: retirar `@nestjs/jwt`, `JWT_SECRET`, `.env.example`, `scripts/demo/runner.ts` y menciones en código | delegada | [x] `9742d22` |
| T4 | Frontend: `credentials: 'include'`, quitar `almacenTokens`, restaurar sesión al recargar, mocks y tests | delegada | [x] `1decfa1` |
| T5 | Docs: D-09 retirada en `CUADRA.md`, entrada en `docs/bitacora.md`, estado de la historia | inline | [x] `c609000` |
| T6 | Cambiar de empresa con la sesión viva (AD-6 "elegir o cambiar"): `GET /auth/empresas` y `POST /auth/empresa/:id` aceptan sesión sin empresa y con empresa; cambiar actualiza la misma fila, rota el token y deja la sesión igual ante 403; el frontend ya no cae en `reingreso` y conoce `puedeCambiarEmpresa` tras recargar | delegada | [x] `8369e38` (backend), `c5d4fd9` (frontend) |
| T7 | Endurecer `RolesGuard` (hallazgo R2/R3 de la revisión de T6): la omisión de membresía para endpoints que aceptan `seleccion` solo aplica si el endpoint no declara `@Roles`; un test fija la interacción | delegada | [x] `74bf686` |

Cada tarea cierra con un commit convencional en la rama; el hash se anota aquí como evidencia.

## Criterios de aceptación

Los de la Story 1.1 en `epics.md`: cookie al iniciar sesión, rotación al elegir empresa (403 sin rol), recarga conserva sesión, 401 tras 8 h, logout borra la fila, GRANTs correctos, JWT retirado y suite de la v1 en verde.

## Verificación

- Backend: `npm run typecheck`, `npm run lint`, `npm test` (Postgres real para integración).
- Frontend: en `frontend/`, `npm run typecheck`, `npm run lint`, `npm test`.

## Progreso

- Mapeo de solo lectura hecho (explorador): flujo JWT, migraciones, tests y AD-2/AD-6 localizados.
- T1 hecha (`27905cc`): migración `1790709100000-Sesiones`, entidad `Sesion`, test de privilegios en `src/database/sesiones-privilegios.integracion.spec.ts` (RED: 7 fallos por tabla inexistente; GREEN tras la migración). Verificación: typecheck limpio, esquema.spec + privilegios 42/42, suite completa 40 suites / 859 tests en verde. Lint: sin errores en archivos tocados; `auth.service.spec.ts:263` (no-unsafe-member-access) y warning en `main.ts:34` ya existían.
- T2 hecha (`dcb2cef`): `SesionesService`, `SesionCookieGuard`, login/empresa/logout por cookie, `cookie-parser` en `main.ts` y en las apps de prueba; helper `src/testing/sesion-de-pruebas.ts`; specs y `scripts/demo/runner.ts` migrados de Bearer a cookie. RED: el spec nuevo no compila en HEAD (falta `sesiones.service`). Verificación: typecheck limpio, lint sin errores (se corrigieron `auth.service.spec.ts:263` y el warning de `main.ts`), suite completa 40 suites / 873 tests en verde.
- T3 hecha (`9742d22`): retirados `@nestjs/jwt` (package.json y lock), `JWT_SECRET` (config, spec, CI), `@ApiBearerAuth` -> `@ApiCookieAuth`, `addBearerAuth` -> `addCookieAuth('cuadra_sesion')` y comentarios de JwtAuthGuard. Sin RED nuevo: refactor cubierto por la suite existente, sin comportamiento nuevo. Verificación: typecheck y lint limpios, suite 40 suites / 872 tests (uno menos: el caso `JWT_SECRET` del `it.each`). `.env.example` aún tiene `JWT_SECRET`; la persona usuaria lo quita a mano. `scripts/` y `docker-compose.yml` no tenían JWT.
- Flaky preexistente: `cargas.listado.integracion.spec.ts:336` (`not.toContain('77')`) falla al azar cuando un UUID del cuerpo contiene "77"; pasa en el rerun. Fuera de alcance.
- T4 hecha (`1decfa1`): cliente con `credentials: 'include'` y sin `Authorization`; `almacenTokens` retirado; arranque en frío con fase `restaurando` (estado público `restoring`) que prueba `GET /auth/contexto` (con los reintentos de las consultas) y, ante 401, `GET /auth/empresas` para retomar la elección; 403 -> `sin_acceso`; elegir empresa aplica el contexto devuelto por el POST (sin segundo GET); logout llama `POST /auth/logout` y luego vacía el cliente. Mocks con sesión simulada (`src/test/sesionMock.ts`); prueba de proxy Vite con `Set-Cookie`/`Cookie`. RED: 12 fallos en `SessionProvider.restauracion.test.tsx` antes de la implementación. Verificación en `frontend/`: typecheck y lint limpios, suite 240 archivos / 3956 pruebas en verde.
- Punto abierto de T4: retomar la elección tras recargar no conoce el nombre: el saludo es "Hola. Tienes acceso a N empresas."; si se quiere el nombre hace falta que `GET /auth/empresas` (o un endpoint nuevo) devuelva el usuario. (El punto sobre cambiar de empresa y `puedeCambiarEmpresa` quedó resuelto en T6.)
- Revisión nativa (RDD activo, riesgo alto): el rango completo (95 archivos, 4323 líneas) falló con `lens_context_budget_exceeded` sin crear autoridad. Se dividió en dos candidatos. Mitad backend T1-T3 (49 archivos, 1858 líneas): 4 lentes, aprobada y acusada; 7 hallazgos no bloqueantes: (a) las sesiones vencidas no se purgan y la tabla crece sin cota (`sesiones.service.ts:69-87` y `:136-138`); (b) el guard hace SELECT + UPDATE por petición autenticada (`sesion-cookie.guard.ts:68-70`); (c) 4 sugerencias de legibilidad en helpers de tests y `renovar`. Mitad frontend T4-T5 (47 archivos, 2471 líneas): también excedió el presupuesto; por decisión de la persona usuaria se omite la revisión nativa (la seguridad vive en el backend ya aprobado; el frontend no guarda token, no toca `document.cookie` ni inyecta HTML, verificado con búsqueda en `frontend/src`).
- Decisión (persona usuaria): resolver el cambio de empresa con sesión viva como T6 dentro de la 1.1, porque AD-6 lo incluye y es el flujo de UJ-1.
- Pendiente aparte de la 1.1: purga de sesiones vencidas y costo de la escritura por petición (hallazgos a y b).
- T6 hecha (`8369e38` backend, `c5d4fd9` frontend): `@Scope(...scopes)` acepta lista; `GET /auth/empresas` y `POST /auth/empresa/:id` aceptan sesión sin y con empresa; `RolesGuard` no exige membresía en la empresa actual a los endpoints que aceptan `seleccion` (así se puede salir de una empresa en la que ya se perdió el rol). Backend RED: 8 fallos en `auth.integracion.spec.ts` (401 en lista/cambio); GREEN: 81/81 en `src/auth`; suite completa 40 suites / 878 tests; typecheck y lint limpios. Frontend RED: 6 fallos nuevos en `SessionProvider.restauracion.test.tsx`; GREEN: evento `EMPRESAS_CONOCIDAS` (atado a la época) y `conocerEmpresas()` tras `RESTAURADA_SESION`, sin bloquear y sin terminar la sesión si falla; mocks por defecto listan con sesión viva, cambian la empresa (A/B) y dan 403 a una ajena. Verificación en `frontend/`: typecheck y lint limpios, 240 archivos / 3964 pruebas en verde.
- Revisión nativa de T6 (backend `8369e38`, 8 archivos, 231 líneas, riesgo alto): 4 lentes, aprobada y acusada. Hallazgos no bloqueantes: `roles.guard.ts:45-51` omite la membresía en todo endpoint que acepta `seleccion`, también si declara `@Roles` (R2 y R3, WARNING; ningún test lo fija); sugerencias: línea larga en `auth.service.ts:114-117` y docs de scope duplicadas en `tipos.ts:3`. Frontend `c5d4fd9`: riesgo medio, bajo presupuesto, sin revisión pendiente.
- T7 hecha (`74bf686`): `RolesGuard` solo omite la membresía si el endpoint acepta `seleccion` y no declara `@Roles`; con `@Roles` sigue el camino normal (403 "Sin acceso a esta empresa" con registro, o "Rol insuficiente"). Docs de `@Scope` y `tipos.ts` ajustadas y comentario largo de `auth.service.ts` reflujado. RED: 2 fallos de 13 en `roles.guard.spec.ts` (casos con `@Roles` resolvían `true`); GREEN: 13/13. Verificación: typecheck y lint limpios, suite 40 suites / 883 tests en verde (una corrida previa falló una vez `esquema.spec.ts` "usa el índice parcial al buscar CFDI abiertas por emisor"; pasa solo y en el rerun completo).
- Siguiente paso: cierre de la historia 1.1.

## Evidencia de routing

- Mapeo: delegado (más de 5 búsquedas secuenciales).
- T1-T4 y T6: escritor delegado (2+ archivos no triviales cada una). T5: inline.
