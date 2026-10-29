# Historia 3.5 (KAN-134): detectar movimientos repetidos entre archivos

Rama `feat/v2-3-5-huellas`, desde `master` tras mergear la 3.4 (#63-#67).
Cubre FR-65. Arquitectura: AD-9, AD-19, AD-12. Historia en
`_bmad-output/planning-artifacts/epics.md` (Story 3.5), UX-DR7.

## Objetivo

Que Cuadra avise cuando dos archivos traen el mismo movimiento (por ejemplo un
PDF y un CSV del mismo mes) y no se concilie dos veces el mismo pago.

## Problema

Hoy no existe huella de movimiento: solo se deduplica por archivo (hash del
archivo). `CUADRA.md:308` dice que no se deduplica por contenido porque dos
cargos idénticos el mismo día son legítimos. El worker CSV inserta fila por fila
sin tomar el candado de empresa y devuelve siempre `existentes: 0`. La vista
previa del PDF no muestra cuántos movimientos son nuevos.

## Decisiones (acordadas con el usuario, 2026-10-30)

1. **Huella:** hash de cuenta normalizada, fecha, monto canónico a 4 decimales y
   referencia normalizada (`normalizarReferencia`). Función pura, versionable.
   - **Exacto:** misma huella y misma referencia cruda.
   - **Dudoso:** misma huella, referencia cruda distinta. Entra como
     `pendiente_revision`, queda fuera de conciliación y nunca se descarta solo.
2. **Filas idénticas legítimas:** se comparan por cantidad. Si la base ya tiene
   1 y el archivo trae 2 iguales, 1 es existente y 1 es nueva.
3. **CSV (sin vista previa):** los exactos se omiten y se cuentan en «ya
   existentes», visibles en el resultado de la carga; los dudosos entran como
   `pendiente_revision`. El worker CSV toma el candado de empresa (AD-19).
4. **Vista previa del PDF:** resumen «N nuevos, M ya existentes, K dudosos».
   Aceptar importa los nuevos y los dudosos. Cuentan como existentes los de
   `movimientos` en cualquier estado, incluidos los descartados.
5. **Filas viejas sin huella:** la migración las rellena con SQL, con prueba de
   paridad contra la función TypeScript (como `referencia_norm`).
6. **Fuera de alcance:** una pantalla para resolver los `pendiente_revision`;
   quedan estacionados (fuera de conciliación y de la bandeja) hasta que exista
   una historia que los resuelva.
7. **Sin decisión pendiente** (se siguen de la historia): índice **no único**
   `(company_id, huella)`; la comprobación corre dentro del candado de empresa;
   el estado `pendiente_revision` se registra en `tipos.ts`, su espejo, el
   `CHECK` y la prueba de deriva.

## Entrega

Estrategia de cadena: **stacked-to-main**, como la 3.3 y la 3.4. Cada PR de la
cadena tiene que pasar el CI por sí solo: un test que cuenta cosas se corrige en
el PR que las agrega. Los límites se anotan aquí al abrirlos.

## Alcance

- Función pura de huella y normalizadores de cuenta, fecha y monto.
- Migración: `movimientos.huella` + índice no único, backfill, estado
  `pendiente_revision` (backend, espejo, `CHECK`, deriva).
- Clasificación de nuevos / exactos / dudosos dentro del candado, con
  multiplicidad; usada al aceptar la vista previa y por el worker CSV.
- Contadores de la carga (`registros_ok`, `registros_existentes`) coherentes con
  `ck_cargas_total_cuadra`.
- Resumen en la vista previa (backend y frontend) y en el resultado del CSV.
- Mockup actualizado y acordado **antes** de la interfaz (UX-DR1, UX-DR9).

Fuera de alcance: pantalla de resolución de `pendiente_revision`; validar el
lector de BBVA con un PDF real (pendiente en `CUADRA.md`).

## Tareas

- [x] **T1 — Huella.** RED primero: función pura `huella({cuenta, fecha, monto,
  referencia})` con casos de normalización (monto `250` y `250.0000`, referencia
  con ceros y símbolos, cuenta nula, fecha), estabilidad y sensibilidad. Sin
  flotantes.
- [x] **T2 — Migración y estado.** `movimientos.huella` + índice no único
  `(company_id, huella)`, backfill SQL con paridad contra la función TS, estado
  `pendiente_revision` (backend, espejo, `CHECK`, deriva, etiquetas) y revisar
  los consumidores (conciliación, bandeja, resolución).
- [x] **T3 — Clasificador dentro del candado.** Dado un lote, devuelve nuevos,
  exactos y dudosos contra `movimientos` con multiplicidad, tomando el candado de
  empresa. Pruebas de concurrencia (dos cargas simultáneas no duplican).
- [ ] **T4 — Aceptar la vista previa.** `GET` suma el resumen; aceptar importa
  nuevos y dudosos, guarda la huella, cuadra los contadores y `ck_cargas_total_cuadra`.
- [ ] **T5 — CSV.** El worker toma el candado, omite exactos (`existentes`),
  guarda dudosos como `pendiente_revision`, y el resultado de la carga lo muestra.
- [ ] **T6 — Mockup.** Resumen en la vista previa (artboard 18) y resultado del CSV
  en Cargas; acordarlo con el usuario. Bloquea T7.
- [ ] **T7 — Frontend.** Resumen en la vista previa, estado `pendiente_revision` y
  resultado del CSV según el mockup acordado.
- [ ] **T8 — Cierre.** Suites completas, `docs/bitacora.md`, `CUADRA.md` (incluida
  la nota de la línea 308), KAN-134, PRs en cadena.

## Aceptación

- Cada movimiento importado guarda su huella; índice no único por empresa.
- La vista previa muestra «N nuevos, M ya existentes, K dudosos»; aceptar importa
  solo lo nuevo y lo dudoso.
- Un dudoso entra como `pendiente_revision`, sin conciliar y sin descartarse.
- Dos cargas simultáneas con los mismos movimientos no duplican nada.
- Filas idénticas legítimas dentro de un archivo se respetan por cantidad.
- La prueba de deriva sigue en verde con el estado nuevo.

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en entidades, migraciones, caminos de inserción y frontend |

## Progreso

- 2026-10-30: documento creado, rama abierta, KAN-134 en curso. Paquete de
  decisiones 1-6 acordado. Siguiente: T1.
- 2026-10-30 T1 hecha (ruta: escritor delegado). `src/bancos/huella-movimiento.ts`:
  `huellaMovimiento` = `v1:` + sha256 de `v1|cuenta|fecha|monto|referencia`
  (cuenta: solo alfanuméricos en mayúsculas; monto: `dinero().toFixed(4)`,
  cero negativo -> `0.0000`; referencia: `normalizarReferencia`, nula -> '').
  `mismaReferenciaCruda` compara tras `trim` (nulo = ''). RED: suite no corría
  (módulo inexistente); GREEN: 18/18 en `huella-movimiento.spec.ts`.
- 2026-10-30 T2 hecha (ruta: escritor delegado). Migración
  `1790710400000-HuellaMovimientos`: función SQL `huella_movimiento` (mismo
  esquema `v1|cuenta|fecha|monto|ref`, GRANT EXECUTE a `cuadra_app`),
  `movimientos.huella` varchar(70) NULL, índice no único
  `ix_movimientos_company_id_huella`, backfill empresa por empresa (RLS FORCE
  alcanza al dueño; se fija `app.company_id` dentro de la transacción) y
  `ck_movimientos_estado` con `pendiente_revision` (down simétrico).
  Decisión: `movimientos_pendientes` NO lleva huella; el clasificador (T3) la
  calcula con `huellaMovimiento` desde sus filas. Consumidores: conciliación,
  bandeja, sugerencias y resolución ya filtran `estado = 'abierto'` (sin
  cambio); `casos.service` ahora da 404 a un `pendiente_revision` (no es un
  caso). El índice parcial `..._fecha_abierto` no cambia. No hay mapas de
  etiquetas de estado de movimiento en el frontend; el espejo y la prueba de
  deriva quedan en verde. Privilegios sin cambio (sin tabla nueva).
  RED: `Tests: 3 failed` (violación de `ck_movimientos_estado` en bandeja,
  conciliación y casos) y paridad sin migración. GREEN: backend 71 suites /
  1523 tests, frontend 4634 tests; eslint, prettier, typecheck y build limpios.
- 2026-10-30 T3 hecha (ruta: escritor delegado). `src/bancos/clasificar-huellas.ts`:
  `emparejar(entrantes, existentes)` (núcleo puro: por grupo de huella, 1 a 1;
  primero exactos por referencia cruda, luego el sobrante como dudoso, el resto
  nuevo; el lote no se empareja consigo mismo) y `clasificarPorHuella(manager,
  companyId, filas)` (una consulta `huella = ANY`, cualquier estado). El candado
  lo toma quien llama (T4/T5); las pruebas de concurrencia viven ahí. RED: las
  dos suites no corrían (módulo inexistente). GREEN: 18/18 (13 puras + 5 con
  Postgres: todos los estados, mezcla exacto/dudoso/nuevo, multiplicidad, otra
  empresa, lote vacío).
