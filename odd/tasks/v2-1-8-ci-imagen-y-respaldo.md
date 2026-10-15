# v2-1-8 · CI que construye la imagen y prueba el respaldo

Rama: `feat/v2-1-8-ci-imagen-y-respaldo` (desde `master` en `643f13e`; la 1.7 ya estaba integrada)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 1.8, FR-56, FR-60, AD-17). Jira: KAN-171.

## Objetivo

Que un cambio al `Dockerfile`, al compose, a las migraciones o al worker no llegue a `master` sin haber construido la imagen de producción, arrancado API y worker, migrado una base limpia y restaurado un respaldo con conteos iguales.

## Estado actual

- `.github/workflows/ci.yml` tiene `pruebas` (Postgres y Redis como servicios, `npm test`) y `frontend`. No construye la imagen ni usa el compose de producción ni el respaldo.
- Piezas listas desde la 1.7: `Dockerfile`, `docker-compose.yml` (api, worker, postgres, redis, `migrate` en perfil `tools`), `scripts/respaldo/{respaldar,restaurar}.sh`, validación de credenciales en producción, siembra compilada (`node dist/database/seeds/seed.js`).

## Alcance autorizado

- Un workflow nuevo `.github/workflows/produccion.yml` con filtro de rutas; `ci.yml` no cambia.
- Pruebas locales del procedimiento con un proyecto Compose aparte (`-p cuadra-ci`).
- Docs: `docs/despliegue.md` (sección de CI), `docs/bitacora.md`.
- Fuera de alcance: lint o format del backend en CI, desplegar a un host, push de imágenes a un registro.

## Decisiones

- **Por defecto, revisables (técnicas):**
  - Workflow separado con `paths` (Dockerfile, compose, migraciones, worker, colas, config, scripts de respaldo, `package*.json`, el propio workflow) para que un PR que no toca infraestructura no pague el tiempo.
  - Secretos de prueba generados en el job (aleatorios, nunca en el repo) y escritos en un `.env` efímero.
  - Se usa el `docker-compose.yml` de producción tal cual, con el proyecto `cuadra-ci`, para ejercitar lo que realmente se despliega.
  - Para sembrar datos de prueba se usa la siembra compilada dentro de la imagen, sin ts-node.
  - La prueba negativa de credenciales corre `node dist/main` con `NODE_ENV=production` y contraseña `cuadra`, y exige código distinto de 0 y el nombre de la variable en la salida.
  - Comprueba también `redis-cli config get maxmemory-policy` = `noeviction`.

## Reglas no negociables que aplican

- Ningún secreto real en el repositorio ni en los logs del workflow.
- Un respaldo no cuenta hasta restaurarlo y comparar conteos.
- Las migraciones nunca corren al arrancar la API.

## Tareas

| ID | Tarea | Ruta | Estado |
|----|-------|------|--------|
| T1 | Workflow `produccion.yml`: construir imagen, levantar con secretos efímeros, migrar, comprobar `/health`, `noeviction`, prueba negativa de credenciales, respaldo con `--verificar`; probado localmente con `-p cuadra-ci` | delegada | [x] `f45aeb6` |
| T2 | Docs: sección de CI en `docs/despliegue.md`, `docs/bitacora.md` | inline | [x] commit de docs |

Cada tarea cierra con un commit convencional; el hash se anota aquí. El workflow solo se confirma en verde al correr en GitHub sobre el PR.

## Criterios de aceptación

- Un PR que toca infraestructura construye la imagen y falla si la construcción falla.
- API y worker arrancan con variables de producción de prueba y `/health` informa PostgreSQL y Redis.
- `migrate` termina sin error sobre una base limpia.
- `respaldar.sh --verificar` pasa con datos de prueba y fallaría con conteos distintos.
- Credenciales de desarrollo con `NODE_ENV=production` hacen fallar el arranque nombrando la variable.
- Un PR que no toca infraestructura no ejecuta estos trabajos.

## Progreso

- T1 (`f45aeb6`): `.github/workflows/produccion.yml`. Ensayado en local con el proyecto `cuadra-ci` (API en 3999, imagen renombrada para no tocar `cuadra-api:latest`): build, prueba negativa (sale != 0 y nombra `DATABASE_URL`), `noeviction`, `migrate`, siembra compilada + `sembrar-dueno`, `/health` con postgres y redis `up`, worker vivo sin reinicios, `respaldar.sh --verificar` OK (17 tablas). `actionlint` 1.7.7 sin hallazgos. Pendiente: verlo en verde en GitHub sobre el PR (no se puede correr desde local).
- T2: sección «Integración continua» en `docs/despliegue.md` y entrada en la bitácora.
