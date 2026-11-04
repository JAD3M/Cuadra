# Historia 4.3: Retirar la tabla vieja de conciliaciones

Rama: `feat/v2-4-3-retirar-conciliaciones`
Jira: KAN-139 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 4.3, líneas 1098-1123)
Spine: AD-20 (paso 4)
Mirror Engram: `odd/v2-4-3-retirar-conciliaciones/tasks`

## Objetivo

Eliminar la tabla `conciliaciones` cuando nada la use, para que no queden dos
fuentes de verdad para una confirmación, sin perder el historial de bitácora.

## Problema

La 4.2 pasó toda la aplicación a `decisiones`; `conciliaciones` quedó solo como
historial, con su entidad, su registro en las listas de RLS y esquema y algún
spec que la siembra. Esta historia la retira con una migración, comprobando
antes que ningún código la nombra. Es irreversible en la práctica: `cuadra_app`
no tiene `DELETE` y la reversión corre con el rol dueño.

## Decisiones

- 2026-11-04: **qué es «nombrar la tabla»** para la prueba de AC1: SQL de
  producción que la consulta (`FROM|JOIN|INTO|UPDATE|TABLE conciliaciones`),
  `@Entity('conciliaciones')` y el import de la entidad `Conciliacion`. No
  cuentan: el nombre histórico de entidad en la bitácora (`'conciliaciones'` en
  `ENTIDADES_BITACORA`, que AD-7 conserva), la ruta `/conciliaciones` y el
  permiso `conciliaciones.resolver` (API sin cambios), ni comentarios.
- 2026-11-04: la migración de retiro **falla en voz alta** si el número de
  decisiones copiadas no cubre el de `conciliaciones` (misma garantía que la
  copia de la 4.1), antes de borrar nada.
- 2026-11-04: el `down` **recrea** la tabla con su esquema original (columnas,
  CHECK, índices, RLS con FORCE, política y GRANTs) y la repuebla desde
  `decisiones`/`decision_lineas` de tipo `conciliacion` con una línea. Es una
  reversión de mejor esfuerzo: una decisión con varias líneas (4.5) o en estados
  que `conciliaciones` no tiene no se puede devolver, y se documenta.
- La bitácora conserva sus filas históricas de la entidad `conciliaciones`.

## Alcance autorizado

- Migración nueva `1790711000000-RetirarConciliaciones.ts`.
- Borrar `src/conciliacion/conciliacion.entity.ts` y su registro en
  `src/database/entidades.ts`.
- Specs: `esquema.spec.ts`, `rls.spec.ts` (listas), `copiar-conciliaciones.spec.ts`
  (la 4.1 se adapta), `resolucion.integracion.spec.ts` (deja de truncar la tabla),
  y las pruebas nuevas de la migración y de la arquitectura.
- Cualquier consulta de producción que aún nombre la tabla.
- `docs/despliegue.md` (procedimiento de reversión).
- No se renombran la ruta ni el permiso. No se adelanta 4.4.

## Reglas no negociables que aplican

- Montos en `NUMERIC`; toda tabla de dominio con `company_id` y RLS (las que
  quedan siguen cumpliéndolo).
- Un falso positivo es peor que no conciliar: ningún guard se relaja.
- Estados y acciones salen de `tipos.ts`.

## Tareas

- [ ] **T1** Corte de retiro: prueba de arquitectura (ningún código de
  producción nombra la tabla), migración de retiro con su verificación y su
  `down`, entidad y registros fuera, specs adaptados, prueba de migraciones desde
  cero y sobre una base con datos v1 (el número de decisiones coincide con el de
  conciliaciones originales).
- [ ] **T2** Documentación de la reversión en `docs/despliegue.md`, bitácora del
  proyecto, `CUADRA.md`, Jira KAN-139, PR y repaso de la historia.

## Evidencia

(Se llena por tarea: ruta, RED, GREEN, hash del commit.)

## Siguiente paso

T1.
