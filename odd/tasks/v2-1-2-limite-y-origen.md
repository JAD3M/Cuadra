# v2-1-2 · Límite de peticiones y origen autorizado

Rama: `feat/v2-1-2-limite-y-origen` (desde `master` en `e4a070a`)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 1.2, FR-57, FR-58, AD-15, AD-6). Jira: KAN-117 (ver `jira-mapping.md`).

## Objetivo

Que el inicio de sesión resista intentos repetidos (más de 5 fallidos por minuto desde la misma dirección responden 429, con el contador en Redis) y que la API solo acepte peticiones del origen autorizado: CORS sin `*` y comprobación de `Origin` en toda petición que cambia datos. Reemplaza la decisión D-11 de la v1.

## Alcance autorizado

- Backend: proveedor de cliente Redis compartido, función `configurarApp` compartida entre `main.ts` y los helpers de prueba, límite declarativo, comprobación de `Origin`, variables de entorno, tests.
- Entorno: `docker-compose.yml` y `.github/workflows/ci.yml` (variables nuevas). `.env.example` lo edita la persona usuaria a mano (su regla `Read(.env.*)` lo bloquea).
- Docs: `CUADRA.md` (D-11 reemplazada, CU-19.13), `docs/bitacora.md`.
- Fuera de alcance: aplicar el límite a recuperación de contraseña e invitaciones (historias 1.5 y 1.6; aquí solo queda el mecanismo listo); el tipo de sesión `plataforma` (1.3).

## Decisiones tomadas por evidencia

- **Librería:** guard propio sobre `ioredis` en vez de `@nestjs/throttler`. El throttler 6.x incrementa antes de ejecutar el handler y no tiene `skipSuccessfulRequests`, así que no cumple «un intento correcto no lo consume de más». El guard lee el contador sin incrementar, y la falla se cuenta después con un script Lua (`INCR` + `EXPIRE`). Declarativo con `@Limite({ intentos, ventanaS, soloFallos })`.
- **IP:** `req.ip`, con `trust proxy` activado solo por variable de entorno. Nunca el correo en la clave ni en el log (D-11, «sin revelar si el correo existe»).
- **Registro del rechazo:** `Logger` de Nest (IP, ruta, método), no `AccesosDenegados`: este escribe en la bitácora de empresa y exige `companyId` y `userId`, que no existen antes de iniciar sesión.
- **Origin ausente:** se rechaza (AD-6: «sin eso se rechaza»). Aplica a toda petición que cambia datos (POST, PUT, PATCH, DELETE), incluido el login, contra el login CSRF.
- **Variables:** `ORIGEN_AUTORIZADO` (URL exacta, nunca `*`, obligatoria) y `TRUST_PROXY` (opcional, apagada por defecto).
- **Claves Redis:** con el prefijo `COLA_PREFIJO` para no mezclar dev y prueba.
- **Redis caído: falla cerrada** (decisión de la persona usuaria, priorizando seguridad). Si Redis no responde, las rutas con límite devuelven 503 con un mensaje claro y quedan en el registro. Solo afecta al inicio de sesión y a las rutas que declaren límite: las sesiones viven en Postgres, así que quien ya entró sigue trabajando, y la comprobación de `Origin` no depende de Redis. El cliente usa timeouts cortos y cola offline desactivada para fallar rápido; un test simula Redis caído.

## Reglas no negociables que aplican

- Ninguna query del dominio sin `company_id`: el límite no toca tablas de dominio.
- Un rechazo no revela si el correo existe (misma respuesta que D-11).

## Tareas

| ID | Tarea | Ruta | Estado |
|----|-------|------|--------|
| T1 | Cimientos: proveedor ioredis compartido con cierre limpio, `configurarApp(app)` (cookie-parser, ValidationPipe, `trust proxy`, CORS exacto) usada por `main.ts` y por los helpers de prueba, variables `ORIGEN_AUTORIZADO` y `TRUST_PROXY` en `env.validation` (+ spec), `docker-compose.yml` y `ci.yml` | delegada | [ ] |
| T2 | Límite declarativo: decorador `@Limite`, guard antes de `SesionCookieGuard`, conteo de fallos con Lua, 429 con mensaje claro, `Logger` sin correo, aplicado al login (5 fallidos por minuto por IP); pruebas: dispara el límite, un intento correcto no consume, `trust proxy` usa la IP real, otra IP no se ve afectada | delegada | [ ] |
| T3 | Origen autorizado: guard de `Origin` en peticiones que cambian datos, 403 sin cambios, CORS sin `*`; migrar helpers y specs que no envían `Origin` (alrededor de 14 archivos y `scripts/demo/runner.ts`) | delegada | [ ] |
| T4 | Docs: D-11 reemplazada y CU-19.13 en `CUADRA.md`, entrada en `docs/bitacora.md`, aviso de las variables para `.env.example` | inline | [ ] |

Cada tarea cierra con un commit convencional en la rama; el hash se anota aquí como evidencia. Tras cada commit se corre `gentle-ai review assess` desde un worktree limpio.

## Criterios de aceptación

Los de la Story 1.2 en `epics.md`: 429 tras más de 5 fallos por minuto con el contador en Redis y sin revelar el correo; mecanismo reutilizable sin código nuevo de contadores; `trust proxy` por variable; origen autorizado sin `*`; 403 si `Origin` no coincide; D-11 reemplazada con una prueba que dispara el límite y otra que muestra que un intento correcto no consume de más.

## Verificación

- Backend: `npm run typecheck`, `npm run lint`, `npm test` (Postgres y Redis reales: `docker compose up -d postgres redis`).
- Frontend: solo si cambia algo (el proxy de Vite ya comparte origen en dev).
- Falla conocida e intermitente: `src/cargas/cargas.listado.integracion.spec.ts:336` y un caso de `src/database/esquema.spec.ts`.

## Progreso

- Mapeo de solo lectura hecho (explorador): Redis hoy solo lo usan BullMQ y un cliente efímero de `/health`; no existe `trust proxy`, CORS ni helmet; ningún spec envía `Origin`; `main.ts` no llega a los tests, por eso `configurarApp`.
- Decisión: Redis caído = falla cerrada (503).
- Siguiente paso: T1.

## Evidencia de routing

- Mapeo: delegado (más de 5 búsquedas secuenciales).
- T1-T3: escritor delegado (2+ archivos no triviales cada una). T4: inline.
