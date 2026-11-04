# Historia 4.1: Preparar las tablas de decisiones y copiar los datos de la v1

Rama: `feat/v2-4-1-tablas-de-decisiones`
Jira: KAN-137 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 4.1, líneas 1022-1056)
Spine: AD-2, AD-3, AD-4, AD-12, AD-20 (pasos 1 y 2)
Mirror Engram: `odd/v2-4-1-tablas-de-decisiones/tasks`

## Objetivo

Crear `decisiones` y `decision_lineas` y copiar cada fila de `conciliaciones`
con el mismo `id`, sin cambiar el comportamiento de la aplicación.

## Problema

La v1 guarda una confirmación como una fila de `conciliaciones` con una sola
factura. El modelo de AD-4 permite varias facturas por depósito y un ciclo de
vida cerrado. Esta historia solo prepara el terreno (AD-20 pasos 1 y 2): el
código sigue leyendo y escribiendo `conciliaciones`.

## Decisiones

- 2026-11-04, mapeo del explorador: `TABLAS_CON_RLS` y `TABLAS_DOMINIO` son
  constantes locales de `src/database/rls.spec.ts:22` y
  `src/database/esquema.spec.ts:18`, no de `entidades.ts` (ahí solo está
  `ENTIDADES`). Se actualizan donde viven.
- 2026-11-04: `decision_comentarios` (AD-2/AD-20 paso 1) **no entra** aquí; los
  criterios de 4.1 piden solo dos tablas y los comentarios son la historia 5.9.
- 2026-11-04: la FK compuesta exige `UNIQUE (id, estado)` en `decisiones` (el
  spine no lo dice). Se agrega, y también las FK compuestas
  `(company_id, movimiento_id)` y `(company_id, cfdi_id)`.
- 2026-11-04: `huella_conjunto` = `'v1:' || sha256(ids ordenados unidos con '|')`,
  mismo estilo que `huella_movimiento`. Es decisión de implementación.
- `diferencia_monto` de `conciliaciones` pasa a la diferencia del grupo.
  `lote_id uuid NULL`; `requiere_revision boolean NOT NULL DEFAULT false`.

## Alcance autorizado

- Migración nueva `1790710700000-TablasDecisiones.ts`.
- Entidades nuevas `Decision` y `DecisionLinea` en `src/conciliacion/`.
- `src/database/entidades.ts`, `src/common/entities/tipos.ts` y su espejo en
  `frontend/src/shared/dominio/tipos.ts` (enums de estado y tipo).
- Espejo TypeScript de `huella_conjunto` y su prueba de paridad.
- `rls.spec.ts`, `esquema.spec.ts` y pruebas de la migración.
- No se toca el código que usa `conciliaciones`. No se adelantan 4.2 ni 4.3.

## Reglas no negociables que aplican

- `company_id`, RLS con FORCE, política y GRANTs de `cuadra_app` en la misma
  migración. Sin `DELETE`.
- Montos en `NUMERIC(18,4)`; estados `VARCHAR` con `CHECK` nombrado (AD-12).
- Columnas generadas `vigente`: fila `GENERATED_COLUMN` en `typeorm_metadata`.
- Backfill empresa por empresa fijando `app.company_id` (plantilla
  `1790710400000-HuellaMovimientos.ts`).

## Tareas

Estimación de planificación: ~400 líneas en total; un solo PR.

- [ ] **T1** Tipos y entidades: enums `ESTADOS_DECISION` (6) y `TIPOS_DECISION`
  con su espejo en el frontend; entidades `Decision` y `DecisionLinea`
  registradas en `ENTIDADES`. Ruta: delegada (escritor).
- [ ] **T2** Migración: tablas, CHECK, FK compuestas, índices únicos parciales,
  RLS FORCE, política y GRANTs; registro de columnas generadas. RED: las specs
  de RLS y esquema fallan con las tablas añadidas a sus listas.
- [ ] **T3** Función SQL `huella_conjunto` + espejo TS + prueba de paridad.
- [ ] **T4** Backfill de `conciliaciones` a `decisiones`/`decision_lineas` con el
  mismo `id`; prueba de conteo, ids de bitácora vigentes y doble empresa.
- [ ] **T5** Cierre: toda la suite de la v1 en verde, entrada en
  `docs/bitacora.md`, estado en `CUADRA.md`, Jira KAN-137, PR.

## Evidencia

(Se llena por tarea: RED, GREEN, hash del commit.)

## Siguiente paso

T1.
