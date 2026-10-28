# v2 · Historia 3.2 — Leer un PDF de BBVA y rechazar lo que no se puede leer

Rama: `feat/v2-3-2-leer-pdf-bbva` (se encadena en PRs si pasa de 400 líneas).
Cubre: FR-1 (parte), FR-7. Arquitectura: AD-8.
Jira: KAN-131 (ver `_bmad-output/planning-artifacts/jira-mapping.md`).
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 3.2, l.818-852).
Base: la 3.1 (`odd/tasks/v2-3-1-cargar-cfdi-y-csv.md`).

## Objetivo

El `contador` sube el PDF del portal de BBVA eligiendo el banco y ve cuántos
movimientos se leyeron. Un lector puro de BBVA devuelve saldo inicial, saldo
final, movimientos normalizados (los campos del CSV canónico) y las líneas que
no pudo leer. No se importa nada todavía (guardar y cuadrar es la 3.3). Un PDF
escaneado o sin texto, mayor de 10 MB o que no esté en MXN se rechaza con el
motivo.

## Estado actual (exploración, 2026-10-27)

- No existe nada de PDF: ni librería en `package.json`, ni archivos `.pdf`, ni
  código de BBVA.
- `EstadoDeCuentaGuard` (`src/cargas/archivos.guard.ts`) acepta solo `.csv`,
  valida solo por extensión (sin MIME ni magic bytes) y limita a 10 MB.
- `cargarEstadoCuenta` (`src/cargas/cargas.service.ts:117-166`) asume siempre un
  perfil JSON de CSV; convierte `EstadoDeCuentaRechazado(mensaje, codigo?)`
  (`src/bancos/lector-estado-cuenta.ts:20`) en 400. Patrón de código estable:
  `moneda_no_mxn`.
- Formato canónico: `MovimientoLeido` (`lector-estado-cuenta.ts:44-52`): fecha
  AAAA-MM-DD, descripcion, referencia|null, monto con signo.
- Idempotencia por `sha256` + índice `ux_cargas_company_id_hash_archivo` ya sirve
  para cualquier tipo de archivo.
- Frontend: `frontend/src/features/cargas/errores.ts` (`ClaseErrorSubida`),
  `textos.ts` (l.64 y l.113 dicen «solo .csv»), `TarjetaEstadoCuenta.tsx:123`
  (`accept`).
- AD-8 manda un lector puro por banco en código (no JSON de perfil) detrás de un
  adaptador delgado de extracción de texto.

## Alcance

- Adaptador de extracción de texto de PDF (librería intercambiable).
- Lector puro de BBVA: texto → `{saldoInicial, saldoFinal, movimientos[],
  lineasNoLeidas[]}`.
- Guard que acepta `.pdf` (con magic bytes `%PDF-`), rechazos con código estable
  y respuesta con el conteo de movimientos leídos, sin importar nada.
- Frontend: textos, `accept`, variante de error para PDF ilegible, conteo.

## Fuera de alcance

- Guardar movimientos y cuadre de saldos (3.3), vista previa (3.4), LLM para
  leer PDF (D-02), otros bancos en PDF.

## Decisiones tomadas

- **Fixture sintético** (acordado el 2026-10-27): no hay un estado de cuenta real
  de BBVA. Se genera un PDF sintético, marcado como tal y sin datos reales. El
  formato queda aislado en un solo lector y la bitácora avisa que falta
  validarlo con un PDF real.
- **Librería candidata: `unpdf`** (MIT, ~2 MB, envuelve pdf.js para servidor).
  Alternativa si falla bajo jest/ESM: `pdfjs-dist` (build legacy). Se confirma en
  el spike de T1 con RED/GREEN reales; el contrato del lector no cambia.

- **Layout sintético de T2** (propuesto el 2026-10-27, SINTÉTICO: no es el
  formato real de BBVA y debe validarse con un PDF real). Texto tal como lo
  entrega la extracción, una línea por renglón:
  - Encabezado: `Periodo DEL 01/10/2026 AL 31/10/2026`, `Moneda MXN`,
    `Saldo Anterior 10,000.00`, `Saldo Final 11,250.50`.
  - Movimiento: `DD/MMM DD/MMM <descripción> <importe> <saldo>`; la primera
    fecha es la de operación (el año sale del periodo). Referencia opcional
    como `Ref. <texto>` al final de la descripción.
  - El texto extraído pierde la columna cargo/abono, así que el **signo se
    deduce del saldo corrido** (saldo − saldo anterior = importe con signo). Si
    no cuadra, la línea va a `lineasNoLeidas`; nunca se adivina el signo
    (un falso positivo es peor que no conciliar).
  - Sin `Moneda MXN` explícita en el encabezado, o con otra moneda, se rechaza
    con `moneda_no_mxn`.

## Tareas

- [x] **T1 — Adaptador de texto PDF + spike de librería.** RED primero: dado un
  PDF con texto devuelve el texto; sin texto/escaneado lanza el rechazo con
  código estable; confirma que la librería corre bajo jest del repo (ESM). Sin
  evidencia de RED no se avanza.
- [x] **T2 — Lector BBVA puro.** Pruebas con texto de ejemplo (no el binario):
  saldos, movimientos normalizados, líneas no leídas, rechazo si no es MXN.
  Fixture PDF sintético marcado en el repo.
- [x] **T3 — Carga por API.** Guard `.pdf` con magic bytes, ramificar por banco
  en `cargarEstadoCuenta`, rechazos (sin texto, >10 MB, no MXN) con código, y
  respuesta con el conteo de movimientos leídos sin importar nada.
- [x] **T4a — Frontend.** Selector de formato «CSV | PDF BBVA» en la tarjeta
  de estado de cuenta, modo PDF (banco fijo, `accept=".pdf"`, aviso de solo
  lectura, «Leer estado de cuenta» / «Leyendo…»), resultado con conteos y
  saldos como cadenas, y alertas `pdf_sin_texto`, `pdf_ilegible`,
  `moneda_no_mxn`. Mockup aprobado (2026-10-27, versión 85) como fuente de
  verdad. Ruta: escritor delegado (2+ archivos). Evidencia en Progreso.
- [ ] **T4b — Cierre.** Bitácora (`docs/bitacora.md`), estado en `CUADRA.md`,
  KAN-131, revisión de la rama completa y PR (en cadena si pasa de 400 líneas).
  Pendiente heredado de T3: `frontend/tests/dominio/cargasEspejo.test.ts`
  espera dos POST con `cargas.cargar` y ahora hay tres.
  - [x] Bitácora y `CUADRA.md` (sección del PDF)
  - [x] Suites completas en verde (ver Progreso)
  - [ ] KAN-131, revisión de la rama completa y PR (los hace el padre)

## Aceptación

Los seis criterios de la Story 3.2 en `epics.md`.

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en backend y frontend |
| T1–T4a | escritor delegado, una tarea a la vez | 2+ archivos no triviales por tarea |

## Progreso

- 2026-10-27: documento creado, rama `feat/v2-3-2-leer-pdf-bbva`. Siguiente: T1.
- 2026-10-27: T1 hecha. Ruta: escritor delegado (2+ archivos). RED: spec sin
  módulo (`Cannot find module './extraer-texto-pdf'`); GREEN: 3/3. Suite
  backend 63 suites / 1363 tests, typecheck, build, lint y prettier OK.
  **Librería: `unpdf` 1.9.1** (MIT). Corre bajo jest (`--experimental-vm-modules`
  del script `test`) y en `dist` CJS con `await import('unpdf')` (Node 24).
  No hizo falta `pdfjs-dist`. Contrato: `extraerTextoPdf(Buffer)` en
  `src/bancos/pdf/`; códigos `pdf_sin_texto` y `pdf_ilegible`. El backend no
  tiene script `format:check` (solo el frontend); se usó `prettier --check`.
- 2026-10-27: T2 hecha. Ruta: escritor delegado (2+ archivos). RED: specs sin
  módulo (`Cannot find module './lector-bbva'`, 2 suites); GREEN: 14 tests
  nuevos. Suite backend 65 suites / 1377 tests, typecheck, build, lint y
  prettier OK. Lector en `src/bancos/pdf/lector-bbva.ts` (aritmética con
  `dinero`, sin flotantes). Una línea que no cuadra no mueve el saldo corrido,
  así que las siguientes también van a `lineasNoLeidas` (nunca se adivina).
  Fixture `src/bancos/fixtures/bbva-sintetico.pdf` (+ LEEME) con banner
  ASCII: el helper pierde la É en Type1. Layout SINTÉTICO, falta PDF real.
  Siguiente: T3.
- 2026-10-27: T3 hecha. Ruta: escritor delegado (2+ archivos). RED: 17/17
  specs en 404 (la ruta no existía). GREEN: 17/17; suite backend 66 suites /
  1394 tests, typecheck, build, lint y prettier OK. **Contrato**:
  `POST /cargas/estado-cuenta/pdf` (`cargas.cargar`; revisor/auditor 403),
  multipart `archivo` (.pdf, 1, <=10 MB, firma `%PDF-`) + `banco` (`bbva`;
  registro en `src/bancos/pdf/lectores-pdf.ts`). 200
  `{banco, saldoInicial, saldoFinal, movimientosLeidos, lineasNoLeidas}`;
  no guarda nada. 400 con `error`: `pdf_sin_texto`, `pdf_ilegible`,
  `moneda_no_mxn`; sin periodo/saldos, 400 solo con mensaje; banco
  desconocido o ausente, 400. Ruta CSV intacta. Siguiente: T4.
- 2026-10-27: seguimiento de la revisión de T3, tres hallazgos menores:
  `banco` vacío o en blanco ahora es 400 "Falta el banco" (DTO con trim +
  `IsNotEmpty`); pruebas de archivo de 3 bytes y de 0 bytes (400); prueba de
  error inesperado del lector (500 genérico, sin filtrar mensaje ni guardar).
- 2026-10-27: T4a hecha. Ruta: escritor delegado (2+ archivos). RED: 32 tests
  fallidos de 110 y 2 suites sin módulo (`useLeerEstadoCuentaPdf`,
  `ResultadoLecturaPdf`) antes de implementar. GREEN: specs nuevas y
  cambiadas 8 archivos / 122 tests; suite frontend 278 de 279 archivos
  (4496 de 4497 tests), typecheck, lint, `format:check` y build OK. La única
  falla es `tests/dominio/cargasEspejo.test.ts` (fuera de la superficie de T4a;
  ya fallaba antes de T4a por el tercer `@Permiso('cargas.cargar')` de T3):
  se corrige en T4b. **Contrato frontend**: `useLeerEstadoCuentaPdf` (POST
  multipart `archivo` + `banco=bbva`, no invalida el historial), schema
  `respuestaLecturaPdf` con saldos `montoDecimal` (cadenas, formateo con
  `decimal.js`). La lista de bancos del PDF es una constante espejo
  (`BANCOS_PDF` en `shared/dominio/cargas.ts`) porque no hay endpoint. El kit
  (`features/kit/SeccionCargas.tsx`) no muestra aún las vistas PDF (fuera de
  la superficie): `modo` y `onModo` de la tarjeta son opcionales para no
  romperlo.
- 2026-10-27: T4b parcial (docs + suites). Bitácora y CUADRA.md escritas. Suites: backend 66 suites / 1399 tests, typecheck, build, lint y prettier OK; frontend vitest 4497 tests, typecheck, lint, format:check y build OK (el espejo de permisos ya pasa). Quedan KAN-131, revisión de la rama completa y PR.
