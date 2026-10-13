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
| T1 | Cimientos: proveedor ioredis compartido con cierre limpio, `configurarApp(app)` (cookie-parser, ValidationPipe, `trust proxy`, CORS exacto) usada por `main.ts` y por los helpers de prueba, variables `ORIGEN_AUTORIZADO` y `TRUST_PROXY` en `env.validation` (+ spec), `docker-compose.yml` y `ci.yml` | delegada | [x] `62a9847` |
| T2 | Límite declarativo: decorador `@Limite`, guard antes de `SesionCookieGuard`, conteo de fallos con Lua, 429 con mensaje claro, `Logger` sin correo, aplicado al login (5 fallidos por minuto por IP); pruebas: dispara el límite, un intento correcto no consume, `trust proxy` usa la IP real, otra IP no se ve afectada | delegada | [x] `b6e5fba` |
| T3 | Origen autorizado: guard de `Origin` en peticiones que cambian datos, 403 sin cambios, CORS sin `*`; migrar helpers y specs que no envían `Origin` (alrededor de 14 archivos y `scripts/demo/runner.ts`) | delegada | [x] `370830d` |
| T4 | Docs: D-11 reemplazada y CU-19.13 en `CUADRA.md`, entrada en `docs/bitacora.md`, aviso de las variables para `.env.example` | inline | [x] `commit de docs` |

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
- T1 hecha (`62a9847`). RED: env.validation.spec, configurar-app.spec y redis.module.spec fallaban (21 casos rojos y dos suites sin poder importar). GREEN: 56 + 9 + 2 casos; suite completa 42 suites, 915 tests; `typecheck` y `lint` limpios. `setupFiles` de Jest (`src/testing/entorno-de-pruebas.ts`) fija `ORIGEN_AUTORIZADO=http://localhost:5173` y borra `TRUST_PROXY` para todos los specs. CORS usa función de origen (con cadena, `cors` respondería siempre ese origen). `RedisModule` aún solo está en `AppModule`: T2 debe importarlo donde inyecte `CLIENTE_REDIS`.
- Revisión nativa de T1: aprobada, con 2 sugerencias de legibilidad (comentar el caso de `Origin` indefinido y las listas de métodos CORS en `configurar-app.ts`; explicar por qué `interpretarTrustProxy` se aplica en el esquema y en `configurarApp`). Aplicadas en T2.
- T2 hecha (`b6e5fba`). Diseño: reserva atómica con Lua (`INCR` + `PEXPIRE` solo si la llave es nueva, devuelve conteo y PTTL) antes del handler; `LimiteInterceptor` devuelve el intento (`DECR`, borra al llegar a 0, nunca crea llave ni toca la caducidad) si la respuesta es 2xx. Guard e interceptor globales vía `PROVEEDORES_LIMITE`, registrados en `AuthModule` antes de `SesionCookieGuard` (el orden por módulo no era fiable, el del arreglo de proveedores sí). Fallo de Redis: 503 y `logger.error` sin URL. Corrección al diseño: tras 4 fallos y un acierto queda 1 fallo de margen (no 4); el acierto neto es cero. RED: con `PROVEEDORES_LIMITE` vacío fallaban 15 casos (10 de `limite.integracion.spec.ts` y 5 de login). GREEN: 73 casos en esos dos archivos; suite completa 43 suites, 931 tests; `typecheck` y `lint` limpios. Los demás specs no tocan el login (abren sesión con `abrirSesion`); solo `auth.integracion.spec.ts` limpia los contadores en `beforeEach`.
- Revisión nativa de T2 (`b6e5fba`, 12 archivos, 742 líneas, riesgo alto): 4 lentes, aprobada y acusada. Hallazgos no bloqueantes: (a) el mensaje 429 dice «Espera un minuto» fijo aunque `@Limite` acepta cualquier `ventanaS` (`limite.guard.ts:19-20`); (b) el prefijo de las claves del límite reutiliza `COLA_PREFIJO`, nombrado para las colas (`limite.guard.ts:42`); (c) 5 intentos y 60 s duplicados como texto en Swagger y tests (`auth.controller.ts:61`).
- T3 hecha (`370830d`). `OrigenGuard` (`src/origen/origen.guard.ts`) registrado como `APP_GUARD` en `AuthModule` antes de `PROVEEDORES_LIMITE`: solo GET, HEAD y OPTIONS pasan sin comprobar; cualquier otro método exige `Origin` idéntico a `ORIGEN_AUTORIZADO` (ausente, `null`, barra final, otro puerto o esquema: 403). Sin Redis, así que un origen malo no consume el límite. Log `warn` con IP, método y plantilla, origen recortado a 64 caracteres. Migración: wrapper `src/testing/supertest-con-origen.ts` (mismo API que `supertest`, pone `Origin` en POST/PUT/PATCH/DELETE) sustituye el import en 12 specs y en `cargas/testing/app-de-cargas.ts`; `subirChunked` y `scripts/demo/runner.ts` (opción `origen`, por omisión `ORIGEN_AUTORIZADO`) lo mandan a mano. RED: con el guard neutralizado fallaban 33 de 40 casos de `origen.guard.spec.ts`, y 4 de los nuevos de auth sin registrarlo. GREEN: 40 + 67 casos en esos dos archivos; suite completa 44 suites, 976 tests; `typecheck` y `lint` limpios. Proxy de Vite: `changeOrigin` solo reescribe `Host`; `Origin` pasa intacto y el navegador lo manda en POST/PUT/PATCH/DELETE (origen por omisión `http://localhost:5173`).
- Revisión nativa de T3 (`370830d`, 19 archivos, 469 líneas, riesgo alto): 4 lentes, aprobada y acusada. Hallazgos no bloqueantes, todos de herramientas de prueba o volumen de log: el envoltorio `supertest-con-origen.ts` castea `ORIGEN_AUTORIZADO` sin fallar claro si falta y expone solo 6 verbos (sin `agent`); el origen por defecto `http://localhost:5173` está duplicado en `scripts/demo/runner.ts`; un aviso de log por cada rechazo sin muestreo (`origen.guard.ts:50-52`).
- T4 hecha: D-11 actualizada en `CUADRA.md` (sigue sin bloqueo de cuenta; el límite ya vive en la aplicación), CU-19.13 sigue vigente, entrada en `docs/bitacora.md`.
- Historia 1.2 cerrada en la rama `feat/v2-1-2-limite-y-origen`, sin push ni PR. Pendientes: mensaje 429 con «un minuto» fijo, prefijo `COLA_PREFIJO` compartido con las colas, y los hallazgos de T3.
- Pendiente de la persona usuaria: agregar `ORIGEN_AUTORIZADO=http://localhost:5173` (y opcional `TRUST_PROXY=1`) a `.env.example` y a su `.env` local.
- Siguiente paso: integrar a `master` y subir, cierre de KAN-117 en Jira, y la historia 1.3.

## Evidencia de routing

- Mapeo: delegado (más de 5 búsquedas secuenciales).
- T1-T3: escritor delegado (2+ archivos no triviales cada una). T4: inline.
