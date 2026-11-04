# Historia 4.2: Pasar propuestas y confirmaciones al modelo de decisiones

Rama: `feat/v2-4-2-propuestas-a-decisiones`
Jira: KAN-138 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 4.2, líneas 1058-1096)
Spine: AD-3, AD-4, AD-7, AD-19, AD-20 (paso 3)
Mirror Engram: `odd/v2-4-2-propuestas-a-decisiones/tasks`

## Objetivo

Que el contador confirme y rechace propuestas como siempre, pero sobre
`decisiones` y `decision_lineas`, con transiciones atómicas verificadas, 409
(nunca 500) en confirmaciones simultáneas y bitácora en la misma sentencia.

## Problema

La 4.1 dejó las tablas nuevas y los datos copiados, pero todo el código sigue
usando `conciliaciones`. Hoy `confirmar` hace tres UPDATE sueltos sin verificar
`rowCount`, marca las hermanas como `rechazada` (no existe `obsoleta`) y escribe
la bitácora con un insert aparte. Ver el mapa del explorador (2026-11-04).

## Decisiones

- 2026-11-04: **sin migración de esquema**; tablas, CHECK (AD-3 y descarte) y
  GRANTs ya existen desde la 4.1.
- 2026-11-04: API y frontend **no cambian** (`/conciliaciones/:id/*`,
  `conciliacionId` = id de la decisión, estados `propuesta | confirmada |
  rechazada`). Una decisión `obsoleta` no sale en bandeja ni en el caso.
- 2026-11-04: las hermanas pasan a `obsoleta` (AD-4) y se toman como en la v1:
  mismo movimiento **o** mismo CFDI. Si no, `ux_decision_lineas_company_cfdi_vigente`
  dejaría propuestas inconfirmables en la bandeja.
- 2026-11-04: la bitácora de cada hermana obsoleta usa la acción `rechazar`
  existente con el motivo `MOTIVO_HERMANA` (AD-7 no añade acciones en 4.2 y la
  v1 ya la auditaba así). Entidad nueva: `decisiones`; `conciliaciones` se
  conserva para el historial.
- 2026-11-04: "vigente" para el motor y las sugerencias pasa a ser estado
  `propuesta | confirmada`; `rechazada` y `obsoleta` no ocupan el par.
- 2026-11-04: orden de bloqueo AD-19: candado de empresa, decisiones por `id`
  ascendente, CFDI, movimiento. `rowCount = 0` → 409; `23505` → 409.

## Alcance autorizado

- `src/conciliacion/`, `src/bandeja/`, `src/casos/`, `src/resolucion/`,
  `src/sugerencias/`, `src/bitacora/` (consultas y escritura).
- `src/common/entities/tipos.ts` (`ENTIDADES_BITACORA`) y su espejo en
  `frontend/src/shared/dominio/tipos.ts` + mocks del frontend si lo exigen.
- Un helper de siembra de decisiones para los specs y la migración de los specs
  que hoy siembran `conciliaciones`.
- No se borra `conciliaciones` (es la 4.3). No se adelantan 4.4 ni 5.x.

## Reglas no negociables que aplican

- Toda consulta con filtro `company_id`; `NUMERIC` para montos.
- El motor decide; el LLM solo sugiere y nunca cierra un caso.
- Un falso positivo es peor que no conciliar.
- Estados y acciones salen de `tipos.ts`; el frontend no inventa valores.

## Tareas

El cambio es un corte atómico (AD-20 paso 3): leer y escribir deben pasar juntos.
Cada tarea se prueba con sus specs; la suite completa solo debe estar en verde al
cerrar el corte (T5). Estimación de planificación: >400 líneas (unas 4.500 de
specs a migrar); estrategia de entrega por acordar.

- [ ] **T1** Helper de siembra de decisiones + `tipos.ts` (`ENTIDADES_BITACORA`
  con `decisiones`) y espejo del frontend. El motor (`conciliar()`) inserta
  cabecera + línea + bitácora en una sentencia y lee "vigente" de `decisiones`.
- [ ] **T2** Bandeja y detalle del caso leen de `decisiones`/`decision_lineas`
  y muestran lo mismo que en la v1.
- [ ] **T3** Resolución: `confirmar` y `rechazar` sobre `decisiones` con
  `rowCount` verificado, hermanas a `obsoleta`, bitácora en la misma sentencia,
  orden de bloqueo AD-19, 409 en simultáneas y en transiciones no permitidas.
  Pruebas nombradas: (a) dos confirmaciones simultáneas del mismo movimiento
  (`Promise.all`): una 200, la otra 409 y ninguna 500; (b) las hermanas quedan
  `obsoleta` en la misma sentencia y con su fila de bitácora; (c) confirmar una
  decisión que no es `propuesta` da 409 sin cambiar nada; (d) `rowCount = 0` y
  `23505` se traducen a 409; (e) factura y movimiento cambian de estado solo con
  la transición.
- [ ] **T4** Sugerencias: exclusiones y persistencia de la IA sobre `decisiones`.
- [ ] **T5** Bitácora (historial y listado leen `decisiones` y conservan las
  filas históricas), specs restantes migrados, suite completa en verde, bitácora
  del proyecto, `CUADRA.md`, Jira KAN-138, PRs y repaso de la historia.

## Evidencia

(Se llena por tarea: ruta, RED, GREEN, hash del commit.)

## Siguiente paso

Acordar la estrategia de entrega y empezar T1.
