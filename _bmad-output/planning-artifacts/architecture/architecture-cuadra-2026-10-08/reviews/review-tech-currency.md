# Review: vigencia tecnica del ARCHITECTURE-SPINE (Cuadra v2)

Fecha: 2026-10-08. Evidencia primaria: codigo de `src/`, `frontend/`, `package.json`, `frontend/package.json`, `docker-compose.yml`, `node_modules` instalados. No se uso web.

## Veredicto
La tabla Stack y los mecanismos que el spine toma de la v1 coinciden con el codigo; los problemas estan en lo que la v2 afirma o asume sin respaldo (cookie/proxy, Redis para rate limit, permisos de `companies/users`, detalles de BullMQ) y en dos imprecisiones sobre la v1.

## 1. Stack vs manifiestos (sin discrepancias)
| Spine | Real | Estado |
| --- | --- | --- |
| NestJS ^11 | `@nestjs/common ^11.0.1`, core ^11 (package.json) | OK |
| TypeORM ^1.1.1 | `^1.1.1`, instalado 1.1.1 | OK |
| pg ^8.23 | `^8.23.0` | OK |
| TypeScript back ^5.7 | `^5.7.3` | OK |
| PostgreSQL 18 | `postgres:18-alpine` (docker-compose.yml); `uuidv7()` usado en `src/common/entities/base.entity.ts:10` y migraciones | OK |
| Redis 7 | `redis:7-alpine` | OK |
| BullMQ ^6 | `^6.3.9`, instalado 6.3.9 | OK |
| decimal.js ^10.6.0 | back y front `^10.6.0` | OK |
| Jest ^30 | `^30.0.0` (nota: `ts-jest ^29.2.5` es un major atras de Jest 30; no esta en el spine, pero conviene verificarlo) | OK / aviso |
| React ^19.3, Vite ^8, Vitest ^5, react-router ^8, TanStack Query ^5, zod ^4, TS ~6.0 | coinciden en `frontend/package.json` (vite instalado 8.3.2) | OK |

No listados en el Stack pero que el spine usa: `ioredis ^5.11.1`, `@nestjs/bullmq ^12`, `multer ^2.4.0`, `supertest ^7` (AD-18), `msw`. Falta anadir al menos ioredis (AD-15) y multer (AD-16) a la tabla.

## 2. Mecanismos
- **Postgres 18 `uuidv7()`**: confirmado, es default de PK en entidades y migraciones. Volumen `pgdata:/var/lib/postgresql` en compose es el layout correcto para la imagen 18. OK.
- **RLS FORCE + `current_setting`**: confirmado. `FORCE ROW LEVEL SECURITY` y politica `company_id = nullif(current_setting('app.company_id', true), '')::uuid` (migraciones `1790641338024-ProcesamientoEnCola.ts:42-47`, `1790709000000-SugerenciasIa.ts:41-46`); `set_config(..., true)` en `src/database/transaccion-empresa.ts:23`; rol `NOBYPASSRLS` en `1790636466878-AislamientoRls.ts:61,69`. OK.
- **BullMQ ^6, `jobId = cargaId`**: confirmado en `src/cargas/cola-cargas.ts:20-45`. Importante: el spine dice "jobId = cargaId" pero omite el comportamiento que la v1 ya tuvo que resolver: BullMQ ignora `add` si el jobId existe aunque este `failed`/`completed`; la v1 lo maneja quitando el job previo (`cola-cargas.ts:33-37`). Con `removeOnComplete: true` y `removeOnFail: {count: 1000}` (`cargas.module.ts` ~l.30-31) los completados se borran pero los fallidos persisten. Un reintento de una carga "fallida" en v2 (estado `pendiente_vista_previa`, reanudacion) depende de esto. Recomendacion: anadirlo como regla en AD-16. Severidad media.
- **`alConfirmar` tras COMMIT**: confirmado (`cargas.service.ts:295`, `transaccion-empresa.interceptor.ts:41-55`). OK. Guard antes de transaccion: `ArchivosXmlGuard` por `@UseGuards` (`cargas.controller.ts:57`); los guards corren antes de los interceptores en Nest, correcto.
- **Eviction de Redis**: BullMQ exige `maxmemory-policy noeviction` (avisa en `redis-connection.js:578`). El compose usa Redis por defecto (noeviction por omision) pero el spine, que hara de Redis contador de rate limit, no lo fija. Si se agrega `maxmemory`/LRU en despliegue, rompe colas. No confirmado en el spine. Severidad baja-media.

## 3. NO confirmado / obsoleto o sin respaldo en el codigo
1. **AD-6 cookie `httpOnly` + `SameSite=Strict` + proxy mismo origen** (severidad alta, por ser un cambio de raiz): hoy no existe ninguna cookie; la v1 usa JWT en `Authorization: Bearer` (`frontend/src/shared/api/client.ts:83`; `src/auth/auth.service.ts:20-21,191-193`; `APP_GUARD JwtAuthGuard` en `src/auth/auth.module.ts:24`) y la seleccion de empresa son dos tokens (5 min / 15 min, D-09). No hay `cookie-parser`, `Set-Cookie` ni `enableCors` (`rg` sin resultados en `src/`). El proxy de Vite (`frontend/config/proxy.ts`) solo cubre desarrollo: reenvia `/api` quitando el prefijo y `changeOrigin: true`; en produccion (AD-17, compose) no hay servidor del frontend ni proxy inverso definido, asi que "mismo origen" no esta demostrado fuera de dev. `SameSite=Strict` mas navegacion desde enlaces de correo (invitaciones, recuperacion, AD-14) no envia la cookie en la primera carga: hay que validarlo con el flujo del enlace. Tampoco se menciona proteccion CSRF mas alla de SameSite. Falta: libreria de cookies de Express 5 y que el mock de pruebas del frontend (MSW, `handlersAuth.ts:82`) asume Bearer.
2. **AD-15 contadores en Redis**: "Redis (ya esta en el stack)" es cierto, pero no hay ningun uso de contadores (`rg incr|throttl|rate.?limit` solo halla `ioredis` en el health check `src/health/redis.health.ts` y una prueba del SDK de Anthropic). La conexion de BullMQ se arma con opciones sueltas, no hay cliente ioredis compartido inyectable. El spine difiere la libreria "se verifica al implementar"; es aceptable, pero el claim de que es una decision tomada es debil: nada la valida todavia. Severidad media-baja.
3. **AD-2: `companies`, `users`, `user_company_roles` "ya fuera de RLS en la v1"**: cierto, pero el rol `cuadra_app` solo tiene `SELECT` sobre ellas (`1790636466878-AislamientoRls.ts:83`). Las historias de F6 (crear empresa, invitar, cambiar/quitar rol, dar de baja) exigen `INSERT/UPDATE` y, para "quitar rol", hoy no hay `DELETE` (`:85` declara "Sin DELETE"). AD-6 dice "quitar un rol ... borra la fila" de `sesiones` y AD-2 dice "sin DELETE": `sesiones` necesita DELETE o se contradice. Severidad alta (contradiccion interna entre AD-2 y AD-6; GRANTs que el spine dice que viajan en la migracion).
4. **AD-3 / `ck_conciliaciones_confirmada_requiere_persona`**: existe (`1790110057425-EsquemaInicial.ts:71`), pero el spine reemplaza `conciliaciones` por `decisiones`/`decision_lineas` (AD-4). Hay que migrar la restriccion y los tests de "el LLM no cierra casos" que la citan (`1790709000000-SugerenciasIa.ts:13`). Es consistente, pero es una migracion destructiva de una tabla con FORCE RLS que el spine no enumera.
5. **AD-12 "Una tabla nueva se registra en `entidades.ts`, `TABLAS_CON_RLS` y `TABLAS_DOMINIO`"**: `entidades.ts` existe (`src/database/entidades.ts`), pero `TABLAS_CON_RLS` esta duplicada en la migracion (`1790636466878-AislamientoRls.ts:22`) y en `rls.spec.ts:22`, y `TABLAS_DOMINIO` solo en `esquema.spec.ts:18`. No hay una unica constante. Precision menor.
6. **AD-14 `ProveedorCorreo` "igual que `ProveedorSugerencia`"**: `ProveedorSugerencia` y su simulado existen (`src/sugerencias/proveedor-simulado.ts`); no hay puerto de correo en v1 (`rg` sin resultados). Es diseno nuevo, bien; solo no es "igual" a algo ya existente de correo.
7. **AD-11 `ROLES_QUE_EDITAN_TOLERANCIA` solo en el frontend**: confirmado (`frontend/src/shared/dominio/tolerancia.ts:18`, uso en `features/tolerancia/vista.ts:4`). Tambien existe `ROLES_QUE_CARGAN` en el mismo patron (`frontend/src/shared/dominio/cargas.ts:40`, `features/cargas/vista.ts`): el spine solo cita un ejemplo; hay al menos dos que migrar a la matriz.
8. **AD-17 respaldo y "credenciales por defecto"**: `docker-compose.yml` fija `cuadra/cuadra` y `cuadra_app/cuadra_app` en claro; no existe script de respaldo (`scripts/` solo contiene `demo`) y no hay Dockerfile de produccion (solo `Dockerfile.dev`, el servicio usa `build: Dockerfile.dev` con volumenes de codigo). El spine lo plantea como trabajo futuro; correcto, pero "la unidad de despliegue es Docker Compose" hoy es un entorno de desarrollo.
9. **AD-9 / idempotencia `sha256` (FR-6)**: confirmada (`cargas.service.ts:98,150,320`, indice `ux_cargas_company_id_hash_archivo` en `:59`). OK.
10. **Worker "mismo codigo" (diagrama)**: confirmado, `ProcesadorCargas` y `ProcesadorSugerencias` corren en el mismo proceso (`colas.module.ts` comenta "D-01"). El spine habla de "Worker BullMQ" como si pudiera separarse: no hay entry point de worker aparte hoy.

## 4. Sin verificar (posible desactualizacion)
- Comportamiento exacto de deduplicacion/`jobId` y remocion en BullMQ 6.3.9: solo contrastado con el codigo de la v1 y el aviso del propio comentario; no se consulto la documentacion oficial.
- Compatibilidad de `typescript ~6.0` con `typescript-eslint ^8.71` y de `ts-jest ^29` con Jest 30 (backend): versiones tomadas de manifiestos; se asume que `npm test` pasa pero no se ejecuto.
- Requisitos de `@nestjs/bullmq ^12` con `bullmq ^6` y Nest 11: solo coinciden en manifiestos.
