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
| T2 | Servicio de sesiones, guard por cookie, endpoints login/empresa/logout/contexto, inactividad 8 h y renovación; migra a cookie los tests y helpers de backend que usaban Bearer (la suite queda en verde en el commit) | delegada | [ ] |
| T3 | Limpieza del JWT: retirar `@nestjs/jwt`, `JWT_SECRET`, `.env.example`, `scripts/demo/runner.ts` y menciones en código | delegada | [ ] |
| T4 | Frontend: `credentials: 'include'`, quitar `almacenTokens`, restaurar sesión al recargar, mocks y tests | delegada | [ ] |
| T5 | Docs: D-09 retirada en `CUADRA.md`, entrada en `docs/bitacora.md`, estado de la historia | inline | [ ] |

Cada tarea cierra con un commit convencional en la rama; el hash se anota aquí como evidencia.

## Criterios de aceptación

Los de la Story 1.1 en `epics.md`: cookie al iniciar sesión, rotación al elegir empresa (403 sin rol), recarga conserva sesión, 401 tras 8 h, logout borra la fila, GRANTs correctos, JWT retirado y suite de la v1 en verde.

## Verificación

- Backend: `npm run typecheck`, `npm run lint`, `npm test` (Postgres real para integración).
- Frontend: en `frontend/`, `npm run typecheck`, `npm run lint`, `npm test`.

## Progreso

- Mapeo de solo lectura hecho (explorador): flujo JWT, migraciones, tests y AD-2/AD-6 localizados.
- T1 hecha (`27905cc`): migración `1790709100000-Sesiones`, entidad `Sesion`, test de privilegios en `src/database/sesiones-privilegios.integracion.spec.ts` (RED: 7 fallos por tabla inexistente; GREEN tras la migración). Verificación: typecheck limpio, esquema.spec + privilegios 42/42, suite completa 40 suites / 859 tests en verde. Lint: sin errores en archivos tocados; `auth.service.spec.ts:263` (no-unsafe-member-access) y warning en `main.ts:34` ya existían.
- Siguiente paso: T2.

## Evidencia de routing

- Mapeo: delegado (más de 5 búsquedas secuenciales).
- T1-T4: escritor delegado (2+ archivos no triviales cada una). T5: inline.
