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
specs a migrar). Estrategia de entrega (2026-11-04, con el usuario): **un solo PR
grande**, porque el corte es atómico y un PR intermedio no pasaría CI. Los
commits por tarea sirven para revisar. Nota de la revisión: la prueba (d) de T3
necesita una forma determinista de forzar `rowCount = 0` y `23505`.

- [x] **T1** Helper de siembra de decisiones + `tipos.ts` (`ENTIDADES_BITACORA`
  con `decisiones`) y espejo del frontend. El motor (`conciliar()`) inserta
  cabecera + línea + bitácora en una sentencia y lee "vigente" de `decisiones`.
- [x] **T2** Bandeja y detalle del caso leen de `decisiones`/`decision_lineas`
  y muestran lo mismo que en la v1.
- [x] **T3** Resolución: `confirmar` y `rechazar` sobre `decisiones` con
  `rowCount` verificado, hermanas a `obsoleta`, bitácora en la misma sentencia,
  orden de bloqueo AD-19, 409 en simultáneas y en transiciones no permitidas.
  Pruebas nombradas: (a) dos confirmaciones simultáneas del mismo movimiento
  (`Promise.all`): una 200, la otra 409 y ninguna 500; (b) las hermanas quedan
  `obsoleta` en la misma sentencia y con su fila de bitácora; (c) confirmar una
  decisión que no es `propuesta` da 409 sin cambiar nada; (d) `rowCount = 0` y
  `23505` se traducen a 409; (e) factura y movimiento cambian de estado solo con
  la transición.
- [x] **T4** Sugerencias: exclusiones y persistencia de la IA sobre `decisiones`.
- [x] **T5** Bitácora (historial y listado leen `decisiones` y conservan las
  filas históricas), specs restantes migrados, suite completa en verde (82
  suites, 1703 pruebas, repetida por el padre), bitácora del proyecto,
  `CUADRA.md`, Jira KAN-138, PR y repaso de la historia.

Commits: T1 `8b31db9`, T2 `2804ba2`, T3 `3571c1a`, T4 `b0e4c50`, T5 `3218132`.
Revisión nativa: T1, T2, T3 y el agregado con T4 aprobados (ver abajo); T5 queda
bajo el presupuesto de 400 líneas.

Revisión: advertencia recurrente («corte parcial») aceptada por el PR único;
falso positivo sobre el índice vigente de `decision_lineas` (una `propuesta`
no es vigente); sugerencia de validar la auditoría en `confirmar` aplicada en T5.

## Evidencia

(Se llena por tarea: ruta, RED, GREEN, hash del commit.)

### T1

- Ruta: escritor delegado (mapa previo en el documento; lectura de preparación
  hecha por el escritor).
- RED: `npm test -- src/conciliacion/conciliacion.integracion.spec.ts` con el
  spec ya migrado a `decisiones`/`decision_lineas` y el motor aún escribiendo
  `conciliaciones`: 24 fallidas, 30 pasan (54).
- GREEN: mismo comando tras migrar el motor (CTE `fuente` -> `cabeceras` ->
  `lineas` -> bitácora en una sentencia): 54/54. `npm test -- src/conciliacion
  src/database src/plataforma`: 21 suites, 412 pruebas en verde. `npx tsc
  --noEmit`, `npx eslint "src/**/*.ts"` y `npx prettier --check "src/**/*.ts"`
  limpios. Frontend: `tests/dominio` 219 en verde, tsc y prettier limpios.
- Pruebas nuevas: obsoleta no ocupa el movimiento, rechazada sigue bloqueando
  aunque exista una obsoleta, cabecera + una línea + huella, y la bitácora con
  entidad `decisiones`.
- Suite completa tras T1: 3 suites rojas (7 pruebas), todas esperadas porque
  aún leen `conciliaciones` (que el motor ya no escribe):
  `src/bitacora/bitacora.integracion.spec.ts` (T5),
  `src/companies/tolerancia.integracion.spec.ts` y
  `src/demo/demo.integracion.spec.ts` (se migran con T5; cuentan como specs
  restantes). 79 suites en verde (1661 pruebas).

### T2

- Ruta: escritor delegado (lectura de preparación hecha por el escritor).
- RED: `npm test -- src/bandeja/bandeja.integracion.spec.ts
  src/casos/casos.integracion.spec.ts` con los dos specs ya sembrando por
  `sembrarDecision` y los servicios aún leyendo `conciliaciones`: 27 fallidas,
  59 pasan (86).
- GREEN: `bandeja.service.ts` (LATERAL sobre `decisiones` + `decision_lineas`,
  `tipo = 'conciliacion'`) y `casos.service.ts` (`CONSULTA` con `decisiones`,
  `decision_lineas` y `cfdi` por la línea). `npm test -- src/bandeja src/casos
  src/conciliacion`: 9 suites, 278 de 279 pasan; la única roja es
  `RS-C5 tras confirmar de verdad (CU-15)` (la confirmación real pasa por
  `src/resolucion`, que sigue sobre `conciliaciones` hasta T3: 404). `npx tsc
  --noEmit`, `npx eslint "src/**/*.ts"` y `npx prettier --check` limpios.
- Pruebas nuevas: obsoleta/rechazada no salen como propuesta ni en bandeja ni
  en el caso (también con score mayor que la viva), conciliado ignora la
  obsoleta, la confirmada trae persona y fecha ISO, empate de score por id
  menor, aislamiento de decisiones de otra empresa, cabecera huérfana sin
  línea no es propuesta, FK `fk_decision_lineas_cfdi` contra CFDI ajeno.
- Suite completa tras T2: 5 suites rojas (9 pruebas), todas esperadas:
  `src/bandeja/bandeja.integracion.spec.ts` (solo RS-C5, vuelve en T3),
  `src/bitacora/bitacora.integracion.spec.ts` (T5),
  `src/companies/tolerancia.integracion.spec.ts` (T5),
  `src/demo/demo.integracion.spec.ts` (T5),
  `src/sugerencias/sugerencias.integracion.spec.ts` (T4, IA-26). 77 suites en
  verde (1667 pruebas).

### T3

- Ruta: escritor delegado (lectura de preparación hecha por el escritor).
- RED: `npm test -- src/resolucion` con el spec ya migrado a `sembrarDecision`
  / `decisiones` / `decision_lineas` / bitácora `decisiones` y el servicio aún
  sobre `conciliaciones` (404 en todo): 56 fallidas, 7 pasan (63).
- GREEN: `resolucion.service.ts` reescrito. Candado de empresa, luego
  `decisiones` (objetivo y hermanas juntas) `ORDER BY id FOR UPDATE`, luego CFDI
  y movimiento. La transición es una sola sentencia CTE (`objetivo` ->
  `hermanas` obsoletas -> `cfdis` -> `movs` -> `auditoria` en bitácora) y se
  verifica lo afectado: decisión sin confirmada_at, CFDI distinto de los
  esperados o movimiento distinto de 1 -> 409 (la excepción revierte la
  transacción de la petición); 23505 -> 409 con `traducir`. `rechazar` hace lo
  mismo con una sentencia (UPDATE guardado + bitácora). `liberoAlgunLado` mira
  decisiones `propuesta/confirmada` por movimiento y por CFDI (vía líneas).
  `npm test -- src/resolucion`: 63/63. `npm test -- src/resolucion src/bandeja
  src/casos src/conciliacion`: 10 suites, 342/342 (RS-C5 de la bandeja vuelve a
  verde sin tocar ese archivo). `npx tsc --noEmit`, `npx eslint "src/**/*.ts"`
  y `npx prettier --check "src/**/*.ts"` limpios.
- Pruebas nuevas (a)-(e): (a) `Promise.all` de dos propuestas del mismo
  movimiento: un 200 y un 409, queda una confirmada y una obsoleta; (b) hermanas
  por movimiento y por solo CFDI quedan `obsoleta` con su línea en cascada y su
  bitácora `rechazar` / `decisiones` / `MOTIVO_HERMANA`, más el CHECK de persona
  y fecha; (c) confirmar rechazada/obsoleta/confirmada y rechazar
  rechazada/obsoleta dan 409 sin cambiar nada; (d) y (e) abajo; más `rechazar`
  libera al motor solo si no queda otra decisión viva.
- Cómo (d) y (e) son deterministas: no hay carreras ni mocks. Un trigger
  `BEFORE UPDATE ... WHEN (OLD.id = '<id>')` que devuelve NULL (creado y borrado
  por el propio test con la conexión del dueño) hace que el UPDATE guardado de
  esa fila (decisión, CFDI o movimiento) afecte 0 filas aunque las
  comprobaciones previas pasaron; se afirma 409 y que decisión, hermanas, línea,
  CFDI, movimiento y bitácora quedan como estaban (rollback completo). Para
  `23505` se siembra otra decisión `confirmada` sobre el mismo movimiento (índice
  vigente de `decisiones`) o sobre el mismo CFDI con otro movimiento (índice
  vigente de `decision_lineas`, que salta al cascadear el estado por la FK).
- Suite completa tras T3: 4 suites rojas (15 pruebas), todas esperadas:
  `src/bitacora/bitacora.integracion.spec.ts`,
  `src/companies/tolerancia.integracion.spec.ts`,
  `src/demo/demo.integracion.spec.ts` (T5) y
  `src/sugerencias/sugerencias.integracion.spec.ts` (T4). 78 suites en verde
  (1678 pruebas).

### T4

- Ruta: escritor delegado (lectura de preparación hecha por el escritor).
- RED: `npm test -- src/sugerencias` con `sugerencias.integracion.spec.ts` y
  `sugerencias-cola.integracion.spec.ts` ya sembrando por `sembrarDecision` /
  leyendo `decisiones` y el código aún sobre `conciliaciones`: 20 fallidas,
  128 pasan (148); 2 suites rojas.
- GREEN: `sugerencias.service.ts` (movimientos elegibles: `NOT EXISTS` sobre
  `decisiones` propuesta/confirmada; pares existentes: `decisiones` +
  `decision_lineas` con propuesta/confirmada/rechazada, la obsoleta no cuenta) y
  `persistencia-sugerencias.ts` (comprobación de ocupado por movimiento o por
  CFDI vía línea; CTE `fuente` (uuidv7) -> `creada` (decisiones, origen `llm`,
  `huella_conjunto(ARRAY[cfdi])`, `ON CONFLICT DO NOTHING`) -> `lineas` ->
  bitácora `decisiones`/`crear` con el mismo payload, en una sentencia; candado
  de empresa primero, igual que antes). `npm test -- src/sugerencias`: 147 de
  148 pasan; la única roja es IA-28 (historial y listado de la bitácora, que
  leen `conciliaciones` hasta T5; el spec ya consulta `entidad=decisiones`).
  `npm test -- src/sugerencias src/resolucion src/bandeja src/casos
  src/conciliacion`: 18 suites, 489 de 490 (la misma IA-28). `npx tsc
  --noEmit`, `npx eslint "src/**/*.ts"` y `npx prettier --check "src/**/*.ts"`
  limpios.
- Pruebas nuevas: bitácora con entidad `decisiones`, cabecera `conciliacion` +
  una línea `propuesta` + origen `llm`; confirmada ocupa el movimiento; obsoleta
  no lo ocupa (se pregunta y se propone); rechazada bloquea volver a sugerir ese
  par; correr dos veces no duplica decisión, línea ni bitácora. Aislamiento por
  empresa y CHECK de `decisiones` (confirmada sin persona) migrados.
- Suite completa tras T4: 4 suites rojas (12 pruebas), todas esperadas:
  `src/bitacora/bitacora.integracion.spec.ts`,
  `src/companies/tolerancia.integracion.spec.ts`,
  `src/demo/demo.integracion.spec.ts` (T5) y
  `src/sugerencias/sugerencias.integracion.spec.ts` (solo IA-28, depende del
  historial/listado de la bitácora de T5). 78 suites en verde (1685 pruebas).

### T5 (código)

- Ruta: escritor delegado (lectura de preparación hecha por el escritor).
- RED: `npm test -- src/bitacora src/companies/tolerancia src/demo
  src/sugerencias/sugerencias.integracion src/resolucion` con los specs ya
  migrados a `decisiones`/`decision_lineas` (`sembrarDecision`) y el servicio
  de bitácora aún leyendo `conciliaciones`: 16 fallidas, 240 pasan (256). Rojas:
  AU-10..AU-13 del historial, HD-1, AU-26, HD-4, IA-28 (sugerencias), las 4 de
  la demo y las 2 nuevas de (f) (confirmar sin la fila de bitácora daba 200).
- GREEN: `bitacora.service.ts` (el 404 y el historial leen `decisiones` y
  aceptan las entidades `conciliaciones` y `decisiones`; el enlace por CFDI o
  movimiento usa `EXISTS` sobre `decision_lineas`/`decisiones` con
  `company_id`, sin join que multiplique filas) y `resolucion.service.ts`
  (`confirmar` exige `auditoria = 1 + hermanas`, mismo 409 y reversión).
  `npm test -- src/bitacora src/companies src/demo src/sugerencias
  src/resolucion`: 20 suites, 362 pruebas en verde. Suite completa del
  backend: 82 suites, 1703 pruebas en verde. `npx tsc --noEmit`, `npx eslint
  "src/**/*.ts"` y `npx prettier --check "src/**/*.ts"` limpios.
- Pruebas nuevas: HD-1 (historial mezcla filas `conciliaciones` y
  `decisiones` en orden), HD-2 (404 de decisión ajena con eventos), HD-3
  (filtro `entidad=decisiones` y `conciliaciones`, sin duplicar por id), HD-4
  (historia por CFDI sin decisiones de otra empresa) y (f) (bitácora faltante
  del objetivo o de una hermana: 409 y reversión total, con trigger).
- Referencias de producción a `conciliaciones` que quedan (ninguna consulta la
  tabla): entidad legacy `conciliacion.entity.ts`, comentario de
  `decision.entity.ts`, nombre histórico de bitácora (`tipos.ts`,
  `bitacora.service.ts`, `bitacora.entity.ts`, DTO), rutas y permisos
  (`@Controller('conciliaciones')`, `conciliaciones.resolver`, matriz) y
  comentarios de `cfdi.entity.ts`/`movimiento.entity.ts`.
- Siguiente paso: cierre T5: bitácora del proyecto, CUADRA.md, Jira, PR único
  y repaso.

## Siguiente paso

PR único, repaso de la historia y la 4.3 (retirar la tabla `conciliaciones`).
