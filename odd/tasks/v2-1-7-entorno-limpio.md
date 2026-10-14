# v2-1-7 · Levantar Cuadra en un entorno limpio, con secretos fuera del repositorio

Rama: `feat/v2-1-7-entorno-limpio` (desde `master` en `b12d11a`; la 1.6 ya estaba integrada)
Fuente: `_bmad-output/planning-artifacts/epics.md:482-515` (Story 1.7, FR-56, FR-60, AD-16, AD-17). Jira: KAN-122.

## Objetivo

Que cualquier persona levante Cuadra completa en una máquina limpia con Docker siguiendo un procedimiento escrito: PostgreSQL 18, Redis con `noeviction`, API y worker; migraciones como paso explícito; arranque que falla nombrando la variable faltante o la credencial por defecto; respaldo y restauración verificados; ruta de salud.

## Estado actual (explorado)

- Existe: compose con `api`, `postgres:18-alpine` y `redis:7-alpine` con healthchecks; migraciones nunca al arrancar la API; validación zod de entorno que nombra la variable; `GET /health` con PostgreSQL y Redis; `.env` ignorado por git; README «De cero a la demo».
- Falta: servicio `worker` (los procesadores BullMQ corren dentro de la API, sin bootstrap propio); `noeviction` explícito en Redis; Dockerfile de producción (solo `Dockerfile.dev`); paso explícito de migraciones en compose; rechazo de credenciales por defecto fuera de desarrollo (compose fija `cuadra/cuadra`); `.dockerignore` que excluya `.env`; script de respaldo y restauración con conteo de filas; procedimiento de despliegue y criterio para elegir el host.

## Alcance autorizado

- Backend: bootstrap del worker y modo que evita que la API consuma colas, validación de credenciales por defecto, pruebas.
- Infra: `docker-compose.yml`, `Dockerfile` de producción, `.dockerignore`, scripts de respaldo y restauración.
- Docs: procedimiento de despliegue y decisión del host, `README.md`, `CUADRA.md`, `docs/bitacora.md`.
- Fuera de alcance: proxy inverso real y TLS (AD-17 los difiere al primer cliente; solo se documenta el criterio), elegir el host, cambios de dominio o de frontend.

## Decisiones

- **Por defecto, revisables (técnicas):**
  - Una sola imagen de producción; el worker es el mismo código con otro comando (`node dist/worker`), servicio propio en compose.
  - La API deja de consumir colas; el worker consume. Pruebas siguen usando `COLA_PREFIJO`.
  - Migraciones: servicio de una sola vez (`migrate`, perfil `tools`) que se ejecuta a mano, nunca dependencia de `api`.
  - Respaldo con `pg_dump` formato custom vía `docker compose exec postgres`; restauración a una base limpia con `pg_restore`; el script compara conteos de las tablas principales.
  - Credenciales por defecto: en `NODE_ENV=production` se rechaza que las contraseñas de `DATABASE_URL` y `DATABASE_APP_URL` coincidan con las de desarrollo conocidas, nombrando la variable.
- **Bloqueo a resolver con la persona usuaria:** `.env.example` está en una ruta denegada por los permisos de esta sesión, así que no se puede leer ni editar. Los criterios exigen revisarlo y agregarle variables.

## Reglas no negociables que aplican

- Secretos nunca en el repositorio ni en la imagen (`.dockerignore`).
- Ninguna migración corre al arrancar la API.
- Falla de arranque nombra la variable.
- Un respaldo no se da por bueno hasta restaurarlo y comparar conteos.

## Tareas

| ID | Tarea | Ruta | Estado |
|----|-------|------|--------|
| T1 | Validación: rechazar credenciales por defecto en producción y `.dockerignore`, con pruebas | delegada | [x] `510dbe0` |
| T2 | Worker: bootstrap propio, la API no consume colas, pruebas | delegada | [x] `3c0d482` |
| T3 | Compose y `Dockerfile` de producción: servicio `worker`, `noeviction` explícito, paso `migrate`, healthcheck de la API | delegada | [x] `0375484` |
| T4 | Scripts de respaldo y restauración con conteo de filas, probados contra la base local | delegada | [x] `7a7f4a3` |
| T5 | Docs: procedimiento de despliegue, criterio del host, `README.md`, `CUADRA.md`, `docs/bitacora.md` | inline | [x] commit de docs |

Cada tarea cierra con un commit convencional; el hash se anota aquí. El `format:check` del frontend y del backend entra en la verificación de cada escritor.

## Criterios de aceptación

- Con Docker en una máquina limpia, el procedimiento levanta PostgreSQL 18, Redis `noeviction`, API y worker; las migraciones son un paso explícito.
- Sin una variable obligatoria o con credencial por defecto fuera de desarrollo, la API no arranca y nombra la variable.
- `.env.example` sin valores reales y archivos con secretos ignorados.
- El respaldo se restaura en una base limpia y los conteos coinciden.
- `/health` informa PostgreSQL y Redis.
- El procedimiento se sigue sin pasos no escritos y documenta cómo se elegirá el host.

## Progreso

T1-T4 hechas y verificadas (tsc, lint, prettier, build, 1158 pruebas).

- T1: el rechazo incluye contraseña vacía; `.dockerignore` excluye `.env*`, `.git`, `node_modules`, `dist`, `.claude`, `odd`, `docs`, `_bmad-output`.
- T2: `PROCESAR_COLAS` (true/false). Sin definir procesa fuera de producción; el worker la fija en true (`src/colas/modo-worker.ts`). Se lee al cargar los módulos (providers estáticos), por eso `procesadoresDeColas()` carga `.env` con dotenv.
- T3: `docker-compose.yml` es producción; `docker-compose.dev.yml` es un archivo completo (no override), porque `:?` se evalúa por archivo. Redis con `noeviction` y `appendonly`. Migraciones compiladas verificadas contra una base temporal.
- T4: `scripts/respaldo/{respaldar,restaurar,comun}.sh`; probado con la base local en una base temporal (16 tablas, conteos iguales; con un conteo alterado sale 1).
- Pendiente de la persona usuaria: `.env.example` (ruta denegada) y `COMPOSE_FILE=docker-compose.dev.yml` en su `.env` de desarrollo.
