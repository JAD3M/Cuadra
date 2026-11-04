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
- 2026-11-04, riesgo conocido: la FK compuesta de AD-4 no incluye company_id; solo el dueño del esquema podría cruzar empresas, RLS cubre al rol de la app.
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

- [x] **T1** Tipos y entidades: enums `ESTADOS_DECISION` (6) y `TIPOS_DECISION`
  con su espejo en el frontend; entidades `Decision` y `DecisionLinea`
  registradas en `ENTIDADES`. Ruta: delegada (escritor).
- [x] **T2** Migración: tablas, CHECK, FK compuestas, índices únicos parciales,
  RLS FORCE, política y GRANTs; registro de columnas generadas. RED: las specs
  de RLS y esquema fallan con las tablas añadidas a sus listas.
- [x] **T3** Función SQL `huella_conjunto` + espejo TS + prueba de paridad.
- [x] **T4** Backfill de `conciliaciones` a `decisiones`/`decision_lineas` con el
  mismo `id`; prueba de conteo, ids de bitácora vigentes y doble empresa.
- [x] **T5** Cierre: toda la suite de la v1 en verde (82 suites, 1665 pruebas),
  entrada en `docs/bitacora.md`, estado en `CUADRA.md`, Jira KAN-137, PR.

Commits: T1+T2 `01063ae` (+ evidencia `67e372e`), T3 `258d6d7`, T4 `1dac727`.
Revisión: T1+T2 aprobada, T3+T4 aprobada.

## Evidencia

(Se llena por tarea: RED, GREEN, hash del commit.)

### T1 + T2 (una sola unidad de trabajo)

- Ruta: delegada (escritor). Evidencia de disparo: 2+ archivos no triviales.
- RED: `npm test -- src/conciliacion/decision.spec.ts src/database/rls.spec.ts src/database/esquema.spec.ts`
  dio 25 pruebas en rojo y 65 en verde (3 suites falladas) por
  `relation "decisiones" does not exist` y las tablas ausentes en las listas
  de RLS y esquema (p. ej. "activa y fuerza RLS en todas las tablas de
  dominio", "crea todas las tablas", los 11 casos de `decision.spec.ts`).
- GREEN: las mismas tres suites, 90/90 en verde (incluye "deja el esquema
  idéntico a las entidades" y "reversibilidad"). Espejo del frontend:
  `deriva.test.ts` pasa de 13 a 15 listas.
- Suite completa: 1643/1644; falla `src/plataforma/plataforma.esquema.spec.ts`
  (prueba de reversibilidad) porque deshace migraciones desde la última y
  ahora la primera es `TablasDecisiones`. Resuelto por el padre: se antepuso
  su undo a esa prueba; las suites afectadas pasan (8/8, 138 pruebas).
- Commit: `01063ae`.
- `tsc --noEmit`, `eslint src` y `prettier --check src` limpios.

### T3

- Ruta: delegada (escritor). Evidencia de disparo: 2+ archivos no triviales
  (migración, espejo TS, paridad, dos specs).
- Decisiones: ids ordenados por valor `uuid`; mayúsculas se normalizan a
  minúsculas en el espejo (el tipo `uuid` lo hace en SQL); duplicados se
  conservan; la lista vacía es válida y es la huella de `'v1|'`.
- RED: `npm test -- src/conciliacion/huella-conjunto.paridad.spec.ts src/plataforma/plataforma.esquema.spec.ts`
  dio 2 suites falladas (1 prueba en rojo, 21 en verde): la paridad por
  `Cannot find module './huella-conjunto'` y la reversibilidad porque el undo
  de `HuellaConjunto` deshacía otra migración. Esa corrida fallida dejó la
  base `_test` con una fila de bitácora inválida; se borró esa fila.
- GREEN: `huella-conjunto.paridad`, `decision` (suma la prueba de CFDI de otra
  empresa contra `fk_decision_lineas_cfdi`) y `plataforma.esquema`: 48/48.
- Suite completa: 81 suites, 1659/1659 en verde. `tsc --noEmit`, `eslint` y
  `prettier --check` limpios.
- Commit: pendiente.

### T4

- Ruta: delegada (escritor). Evidencia de disparo: 2+ archivos no triviales
  (migración, spec de copia, spec de reversibilidad).
- Migración `1790710900000-CopiarConciliacionesADecisiones.ts`: copia por
  empresa (fija `app.company_id` en la transacción), mismo `id`, `created_at`
  y `updated_at`; `huella_conjunto(ARRAY[cfdi_id])`; una línea por decisión;
  idempotente (`ON CONFLICT (id) DO NOTHING` y línea solo si no existe). Falla
  si los conteos por empresa (origen, decisiones, líneas) difieren. `down`
  borra solo decisiones con id en `conciliaciones` y sus líneas, como dueño
  (`cuadra_app` no tiene DELETE).
- Caso límite de datos v1: ninguno. `ux_conciliaciones_par` impide dos filas
  con mismo movimiento y CFDI (misma huella), y los únicos parciales de
  confirmadas de la v1 equivalen a los de `vigente` de la 4.1. Si algo
  chocara, el INSERT falla en voz alta; no se descarta nada.
- Nota técnica: TypeORM trata como migración toda función exportada del
  archivo; por eso solo se exportan constantes SQL y la clase, y la spec corre
  `new CopiarConciliacionesADecisiones1790710900000().up(qr)`.
- RED: `npm test -- src/conciliacion/copiar-conciliaciones.spec.ts` dio
  `Cannot find module '../database/migrations/1790710900000-CopiarConciliacionesADecisiones'`
  (1 suite fallada, 0 pruebas). Un segundo RED intermedio por exportar una
  función (`migrationClass is not a constructor`, 6 en rojo) llevó al ajuste
  anterior. El undo de la nueva migración en la prueba de reversibilidad se
  antepuso junto con la migración.
- GREEN: `copiar-conciliaciones.spec.ts` 6/6 (conteos y ids por empresa, línea
  por decisión con CFDI y `estado_decision`, `vigente` solo en confirmada,
  huella = espejo TS, fechas, bitácora sin huérfanas, idempotencia,
  `conciliaciones` intacta, aislamiento como `cuadra_app`).
  `plataforma.esquema` + `src/conciliacion` + `src/database`: 14 suites, 317/317.
- Suite completa: 82 suites, 1665/1665. `tsc --noEmit`, `eslint` y
  `prettier --check` limpios.
- Commit: pendiente.

## Siguiente paso

T5.
