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

## Tareas

- [x] **T1 — Adaptador de texto PDF + spike de librería.** RED primero: dado un
  PDF con texto devuelve el texto; sin texto/escaneado lanza el rechazo con
  código estable; confirma que la librería corre bajo jest del repo (ESM). Sin
  evidencia de RED no se avanza.
- [ ] **T2 — Lector BBVA puro.** Pruebas con texto de ejemplo (no el binario):
  saldos, movimientos normalizados, líneas no leídas, rechazo si no es MXN.
  Fixture PDF sintético marcado en el repo.
- [ ] **T3 — Carga por API.** Guard `.pdf` con magic bytes, ramificar por banco
  en `cargarEstadoCuenta`, rechazos (sin texto, >10 MB, no MXN) con código, y
  respuesta con el conteo de movimientos leídos sin importar nada.
- [ ] **T4 — Frontend y cierre.** Textos, `accept`, variante de error, conteo;
  suites completas, lint y `format:check`; bitácora; `CUADRA.md`; KAN-131; PR.
  Mockup: si la pantalla necesita algo que no tiene, primero se actualiza el
  mockup y se acuerda.

## Aceptación

Los seis criterios de la Story 3.2 en `epics.md`.

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en backend y frontend |
| T1–T4 | escritor delegado, una tarea a la vez | 2+ archivos no triviales por tarea |

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
