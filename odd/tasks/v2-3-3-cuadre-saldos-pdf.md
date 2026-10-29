# Historia 3.3 (KAN-132): rechazar el PDF cuyos saldos no cuadran, y guardar el que sí

Rama `feat/v2-3-3-cuadre-saldos-pdf`, desde `master` tras la 3.1 y sus pendientes.
Cubre FR-1, FR-2, FR-52. Arquitectura: AD-8, AD-12, AD-16. Historia en
`_bmad-output/planning-artifacts/epics.md` (Story 3.3).

## Objetivo

Que Cuadra compruebe que saldo inicial + abonos − cargos = saldo final antes de
guardar nada de un PDF, y que lo que cuadra se guarde en una zona de espera
hasta la vista previa (3.4).

## Problema

Hoy `POST /cargas/estado-cuenta/pdf` solo lee: no guarda, no lleva `companyId`
y no deja bitácora. No existe función de cuadre ni el estado
`pendiente_vista_previa`, ni zona de espera de movimientos.

## Decisiones (acordadas con el usuario, 2026-10-29)

1. **Rechazo sin carga.** Un PDF rechazado no crea carga ni movimientos.
2. **Bitácora del rechazo:** `bitacora.entidad_id` pasa a ser nullable **solo**
   para la acción `rechazar` (CHECK en la misma migración). Se registra persona,
   fecha, nombre del archivo y motivo; nunca el contenido.
3. **También se registran** los rechazos de lectura (`pdf_sin_texto`,
   `pdf_ilegible`, `moneda_no_mxn`), no solo el de saldos.
4. **Líneas no leídas rechazan:** aunque los saldos cuadren, un PDF con alguna
   línea no leída se rechaza (un falso positivo es peor que no conciliar).
5. **Qué se guarda:** solo los movimientos ya leídos (zona de espera) y el hash
   del archivo. No se guarda el PDF original.
6. **Idempotencia:** resubir un PDF ya cargado devuelve la carga existente
   (`yaExistia`), sin duplicar. Un PDF rechazado se puede volver a subir.
7. **PDF sin movimientos** (decidido el 2026-10-29, a raíz de T3): se rechaza
   con el código `sin_movimientos`, aunque los saldos cuadren (lo más probable
   es que el lector no leyera nada). Va al final de las comprobaciones: antes
   mandan `saldos_no_cuadran` y `lineas_no_leidas`. Deja bitácora `rechazar`
   como los demás. Es la tarea T3b.
8. **Reenvío de un PDF ya cargado** (decidido el 2026-10-29): se muestra igual
   que un PDF recién guardado (`yaExistia: true` no se distingue en la
   interfaz). No hay estado nuevo en el mockup; el aviso «en cola» del CSV/CFDI
   sería falso para `pendiente_vista_previa`.
9. **Sin decisión pendiente** (se siguen de la historia): el 400 lleva el motivo
   y las líneas no leídas (UX-DR8); el cuadre es exacto, tolerancia cero, con
   `dinero`; `pendiente_vista_previa` cuenta como estado concluido para el
   polling y el worker no lo toma.

## Entrega

Estrategia de cadena: **stacked-to-main** (acordada el 2026-10-29). Pronóstico
sobre 400 líneas de cambio, así que va en PRs en cadena, cada uno contra
`master` en orden. Los límites de cada PR se anotan aquí al abrirlos.

## Alcance

- Una sola función común de cuadre (cualquier banco), aritmética con `dinero`.
- Estado `pendiente_vista_previa` en `tipos.ts`, su espejo del frontend, el
  `CHECK` de la migración y la prueba de deriva.
- Zona de espera de movimientos: tabla nueva con `company_id`, RLS con FORCE,
  política y GRANTs a `cuadra_app` en la misma migración; `NUMERIC` para montos.
- Endpoint del PDF: guarda lo que cuadra, rechaza lo demás, deja bitácora.
- Frontend: resultado de la carga y rechazo con las líneas no leídas.

Fuera de alcance: vista previa y paso a `movimientos` (3.4), movimientos
repetidos entre archivos (3.5), validar el lector con un PDF real de BBVA
(pendiente anotado en `CUADRA.md`; la 3.3 no confía en el lector con datos
reales hasta entonces).

## Tareas

- [x] **T1 — Cuadre común.** RED primero: función pura
  `cuadrarSaldos({saldoInicial, saldoFinal, montos})` con casos que cuadran,
  que no cuadran por un centavo, abonos y cargos mezclados, y montos grandes
  sin flotantes.
- [x] **T2 — Migración y estado.** `pendiente_vista_previa` (backend, espejo,
  deriva, `FASE_CARGA`, etiquetas, tonos); `ck_cargas_estado` y
  `ck_cargas_total_cuadra` revisados; tabla de zona de espera con RLS FORCE y
  GRANTs; `entidad_id` nullable con CHECK solo para `rechazar`. Prueba de que
  otra empresa no ve nada.
- [x] **T3 — Endpoint del PDF.** Guarda lo que cuadra (carga en
  `pendiente_vista_previa` + movimientos en espera + hash), rechaza saldos que
  no cuadran y líneas no leídas con 400 que lleva motivo y líneas, reutiliza la
  carga si el hash ya existe, y deja bitácora en los cuatro rechazos y al crear.
  El worker no encola estas cargas. Pruebas de permisos (403 del auditor).
- [x] **T3b — PDF sin movimientos.** RED primero: un PDF con saldo inicial igual
  al final y cero movimientos se rechaza con `sin_movimientos` (400, sin carga
  ni movimientos, bitácora `rechazar`). Con saldos que no cuadran sigue
  mandando `saldos_no_cuadran`, y con líneas no leídas `lineas_no_leidas`.
- [x] **T4 — Frontend.** Resultado de la carga guardada y rechazo con motivo y
  líneas no leídas. Se lee el mockup primero; si falta algo, se actualiza el
  mockup y se acuerda antes de escribir código.
- [x] **T4b — Saldo final en el rechazo y hallazgos de la revisión.** Backend:
  el 400 `saldos_no_cuadran` incluye `saldoFinal` (texto decimal; el mockup
  pide «Saldo final del PDF»), con prueba. Frontend: la fila «Saldo final del
  PDF» se pinta; la lista de líneas no leídas deja de usar `linea` como `key`
  (puede repetirse); un 400 de PDF con código conocido pero cuerpo incompleto
  muestra su rechazo con título y mensaje, sin los detalles que falten, y no el
  rechazo genérico.
- [ ] **T5 — Cierre.** Suites completas (backend y frontend), lint y formato,
  entrada en `docs/bitacora.md`, `CUADRA.md` y KAN-132, PR (en cadena si pasa de
  400 líneas).

## Aceptación

- Un PDF que no cuadra, o con líneas no leídas, se rechaza completo, sin carga
  ni movimientos, con motivo y líneas; queda en la bitácora.
- Un PDF que cuadra crea una carga `pendiente_vista_previa` con sus movimientos
  en espera, sin entrar a conciliación.
- El cuadre vive en una sola función común y no usa flotantes.
- Cada tabla nueva lleva `company_id`, RLS con FORCE, política y GRANTs.
- Resubir el mismo PDF no duplica nada.

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en cargas, bancos, migraciones y frontend |

## Progreso

- 2026-10-29: documento creado, rama abierta, KAN-132 en curso. Siguiente: T1.
- 2026-10-29: T1 hecha (`src/bancos/cuadre-saldos.ts`). RED: `Cannot find module
  ./cuadre-saldos` (suite falló, 0 pruebas); GREEN: 9/9, suite completa 1423
  pruebas, typecheck, build, eslint y prettier limpios. Sin commit. Siguiente: T2.
- 2026-10-29: T2 hecha. RED: 12 fallos en
  `movimientos-pendientes.integracion.spec.ts` (`ck_cargas_estado`, tabla
  inexistente, `entidad_id` NOT NULL), 4 en esquema/rls y 2 en `cargas.test.ts`
  del frontend, 1 en el contrato de bitácora (`entidadId` null). Migración
  `1790710200000-PendienteVistaPrevia`, entidad, estado, espejo, bitácora
  nullable solo en rechazos. GREEN: backend 1436 pruebas, frontend 4500;
  typecheck, build, eslint y prettier limpios en ambos. Sin commit. Siguiente: T3.
- 2026-10-29: T3 hecha. RED: `estado-cuenta-pdf.integracion.spec.ts`, 11 de 31
  fallaban (guardar, `yaExistia`, carrera, otra empresa, `saldos_no_cuadran`,
  `lineas_no_leidas`, 3 rechazos de lectura en bitácora, reintento, bitácora por
  empresa). Rechazo: `registrarRechazoDePdf` abre su propia transacción de
  empresa (como `AccesosDenegados`), así la entrada sobrevive al 400. Carrera
  por hash: `crearCarga` con savepoint y el índice único. GREEN: backend 1445
  pruebas, frontend 4500; typecheck, build, eslint y prettier limpios. Sin
  commit. Siguiente: T4.
- 2026-10-29: T3b hecha. RED: `estado-cuenta-pdf.integracion.spec.ts`, 1 de 33
  fallaba (`sin_movimientos`: `expected 400 "Bad Request", got 200 "OK"`; antes
  se guardaba una carga vacía). El orden (saldos que no cuadran con cero
  movimientos) ya pasaba. GREEN: backend 1447 pruebas; typecheck, build, eslint
  y prettier limpios. Sin commit. Siguiente: T4.
- 2026-10-29: T4 hecha (frontend). RED: 20 pruebas fallaban (`ApiError.cuerpo`
  indefinido; `clasificarErrorSubida` devolvía `rechazo` para los tres códigos
  nuevos; contrato sin `cargaId/estado/yaExistia`; `ResultadoLecturaPdf`,
  `AlertaSubida`, `CargasContenedorPdf` y `detalleEvento` sin las vistas nuevas;
  el hook no invalidaba el historial). `ApiError.cuerpo` (aditivo) lleva el 400
  completo; vistas del mockup v88 para guardado y los tres rechazos; detalle de
  bitácora del rechazo de PDF. Hueco de backend: el 400 `saldos_no_cuadran` no
  trae `saldoFinal`, así que la fila «Saldo final del PDF» del mockup no se pinta
  (el contrato la acepta opcional). GREEN: frontend 4521 pruebas; typecheck,
  lint, format:check y build limpios. Sin commit. Siguiente: T5.
- 2026-10-29: T4b hecha. RED: backend `estado-cuenta-pdf.integracion.spec.ts`, 1
  de 33 (`saldoFinal` esperado "11250.50", recibido undefined); frontend 4
  pruebas (`errores.test.ts`: saldos_no_cuadran y lineas_no_leidas con cuerpo
  incompleto caían a `rechazo`; `DetalleRechazoPdf.test.tsx`: monto suelto
  exigía todos los campos y la `key` repetida dio aviso de React). El
  clasificador ya pasaba `saldoFinal` y la fila ya existía. El 400 lleva
  `saldoFinal` (texto del lector); contrato tolerante (campos inválidos se
  omiten); `key` = índice + línea. Sin commit. Siguiente: T5.
