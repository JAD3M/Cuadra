# v2 · Pendientes de la historia 3.1 (cargas)

Rama: `feat/v2-3-1-05-pendientes-cargas` (un solo PR; el cambio es pequeño).
Jira: sin ticket propio (cola de KAN-130, ya Finalizado).
Base: 3.1 (`odd/tasks/v2-3-1-cargar-cfdi-y-csv.md`) y 3.2.

## Objetivo

Cerrar tres pendientes que quedaron anotados al integrar la 3.1:
1. Un CSV de estado de cuenta en otra moneda sin columna `moneda` pasa como
   pesos: toda carga de estado de cuenta debe declarar su moneda.
2. Una carga fallida que se reanuda deja una segunda entrada `cargar` sin
   distinguirla de la primera.
3. La prueba de permisos no incluye la ruta del PDF en la tabla de acciones del
   auditor.

## Estado actual (exploración, 2026-10-27)

- **Moneda:** solo el perfil `cuadra` declara `columnaMoneda`
  (`src/bancos/perfil.ts:44-49`, `src/bancos/perfiles/cuadra.json:14`). Los
  perfiles `banco-norte` y `banco-sur` no declaran nada. Sin columna, el lector
  salta la verificación (`src/bancos/lector-estado-cuenta.ts:128-155`) y una
  celda vacía cuenta como MXN (`esMxn`, `:139-142`). CUADRA.md:350-355 documenta
  «sin la columna se asume MXN». La prueba
  `estado-cuenta.integracion.spec.ts:565-575` fija ese comportamiento.
- **Reanudación:** `registrarCargar` (`src/cargas/registrar-carga.ts:16-41`) es un
  `INSERT … SELECT` llamado desde el worker al terminar (`procesador-cargas.ts:169`)
  y al marcar fallida (`:190`). `reanudar` (`cargas.service.ts:308-340`) devuelve
  la carga a `pendiente`; al terminar de nuevo se escribe otra entrada, sin
  unicidad por carga y sin prueba que lo cubra.
- **Auditor:** hay pruebas 403 para las cinco rutas de cargas
  (`permisos.integracion.spec.ts` y `estado-cuenta-pdf.integracion.spec.ts`);
  solo falta la fila del PDF en la tabla `ACCIONES`
  (`permisos.integracion.spec.ts:75-81`) que además verifica la entrada
  `acceso_denegado` y que nada cambió.

## Alcance

- Backend, fixtures, pruebas y docs. Sin cambios de interfaz salvo lo que dicte
  el mensaje de rechazo (el 400 con motivo ya se muestra tal cual).

## Fuera de alcance

- El filtro «Entidad» de la bitácora y su mockup (decide el usuario aparte).
- Validar el lector de PDF con un estado de cuenta real de BBVA.
- Campo de moneda en el formulario de subida (opción descartada).

## Decisiones tomadas

- **Moneda (acordado el 2026-10-27, opciones 1 + 2):** todo perfil declara su
  moneda, ya sea con `columnaMoneda` o con un campo `moneda` en su JSON.
  - El esquema del perfil exige exactamente una de las dos.
  - `banco-norte` y `banco-sur` declaran `"moneda": "MXN"`.
  - En `cuadra` la columna `moneda` pasa a ser **obligatoria**: si falta en el
    encabezado se rechaza el archivo completo con un motivo claro; una celda
    vacía ya no cuenta como MXN y se rechaza igual. Un valor distinto de MXN
    sigue dando `moneda_no_mxn`. Un perfil que declare una moneda distinta de
    MXN rechaza el archivo con `moneda_no_mxn`.
  - Se actualizan fixtures, pruebas y CUADRA.md (ya no se asume MXN).
- **Reanudación (acordado el 2026-10-27):** se conservan las dos entradas y la
  que sigue a una reanudación lleva `reanudada: true` en `datos`. Sin migración;
  la bitácora sigue siendo solo de agregar.

## Tareas

- [x] **T1 — Moneda obligatoria por perfil.** RED primero: perfil sin
  `columnaMoneda` ni `moneda` no carga; `cuadra` sin columna en el encabezado se
  rechaza; celda vacía se rechaza; `banco-norte`/`banco-sur` con `moneda: MXN` se
  leen igual; perfil con moneda distinta de MXN rechaza con `moneda_no_mxn`.
  Fixtures, pruebas, CUADRA.md y revisión de textos del frontend que digan «se
  asume MXN».
- [x] **T2 — Marca de reanudación en la bitácora.** RED primero: carga fallida
  reanudada que termina deja dos entradas `cargar`, la segunda con
  `reanudada: true` y la primera sin ella; aislada por empresa.
- [ ] **T3 — Prueba del auditor para el PDF.** Fila en `ACCIONES` con la
  entrada `acceso_denegado` y sin cambios persistidos.
- [ ] **T4 — Cierre.** Suites completas (backend y frontend), lint y formato,
  entrada en `docs/bitacora.md`, PR.

## Aceptación

- Ningún estado de cuenta se procesa sin una moneda declarada; no hay MXN por
  omisión.
- Una reanudación se distingue en la bitácora; nada se sobrescribe.
- La ruta del PDF está en la tabla de 403 del auditor.

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en cargas y bancos |
| T1 | escritor delegado | 2+ archivos no triviales (esquema, lector, perfiles, fixtures, docs) |
| T1 (ampliación) | escritor delegado | superficies ampliadas con `scripts/demo/formatos.ts` y `src/demo/ayudas-demo.ts` (autorizado por el usuario): el generador y el lector de la demo usan el perfil `cuadra` |
| T2–T3 | escritor delegado | pruebas de integración con base compartida |

## Progreso

- 2026-10-27: documento creado y rama abierta. Siguiente: T1.
- 2026-10-27: T1 hecha. RED observado (8 pruebas en `lector-estado-cuenta.spec.ts`)
  y luego verde: `npm test` 66 suites / 1410 pruebas, typecheck, build, lint y
  prettier limpios. `moneda_faltante` (columna ausente o celda vacía) y
  `moneda_no_mxn`; `banco-norte`/`banco-sur` con `"moneda": "MXN"`; fixtures y
  `demo/*.csv` (regenerados con `npm run demo:generar`) llevan `moneda`. Sin
  cambios de frontend: el 400 ya se muestra tal cual. Commit de trabajo:
  `feat(bancos): la moneda de cada perfil es obligatoria`. Siguiente: T2.
- 2026-10-27: T2 hecha (escritor delegado). RED observado: la segunda entrada
  `cargar` no traía `reanudada` (`Expected - 1: "reanudada": true`). Verde:
  `registrarCargar` deriva la marca de una entrada `cargar` previa de la misma
  carga y empresa; se conservan las dos entradas, la primera sin la clave. Las
  pruebas de reintento y `yaExistia` siguen con una sola entrada. El frontend
  lee `datos` sin tipar, así que no cambia. Siguiente: T3.
