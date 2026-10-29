# Historia 3.4 (KAN-133): revisar la vista previa antes de importar

Rama `feat/v2-3-4-vista-previa`, desde `master` tras mergear la 3.3 (#59-#62).
Cubre FR-3 (parte). Arquitectura: AD-8, AD-4, AD-19. Historia en
`_bmad-output/planning-artifacts/epics.md` (Story 3.4).

## Objetivo

Que el contador vea lo que Cuadra leyó del PDF (movimientos, total, saldos) y
lo acepte o rechace antes de que algo entre a conciliación.

## Problema

Una carga `pendiente_vista_previa` deja sus movimientos en
`movimientos_pendientes` (solo `SELECT` e `INSERT` para `cuadra_app`) y no hay
forma de pasarlos a `movimientos` ni de descartarlos. Los saldos inicial y final
del PDF no se guardan. No existe un estado para la carga descartada.

## Decisiones (acordadas con el usuario, 2026-10-29)

1. **Estado nuevo `rechazada`** para la carga que el contador descarta. No se
   reutiliza `fallida`: mezclaría «falló la lectura» con «la descartó la
   persona».
2. **Saldos persistidos:** columnas `saldo_inicial` y `saldo_final` (`NUMERIC`,
   nulas para cargas que no vienen de PDF) en `cargas`, escritas al guardar el
   PDF. El PDF original no se guarda (decisión 5 de la 3.3).
3. **Sin decisión pendiente** (se siguen de la historia): aceptar toma el
   candado de empresa (AD-19) y mueve las filas en una sola transacción; mientras
   la carga está en espera, bandeja y conciliación no ven sus movimientos;
   aceptar y rechazar exigen `cargas.cargar` (403 con acceso denegado).

## Entrega

Estrategia de cadena: **stacked-to-main**, como la 3.3. Pronóstico sobre 400
líneas de cambio: PRs en cadena, cada uno contra `master` en orden. Los límites
se anotan aquí al abrirlos.

## Alcance

- Migración: estado `rechazada`, saldos en `cargas`, `DELETE` en la zona de
  espera, y lo que necesite el paso a `movimientos`.
- Espejo del estado en `tipos.ts`, frontend, `CHECK` y prueba de deriva.
- `GET` de la vista previa, `POST` aceptar y `POST` rechazar.
- Mockup de la vista previa, acordado **antes** de la interfaz (UX-DR1, UX-DR9).
- Frontend de la vista previa.

Fuera de alcance: resumen «N nuevos, M ya existentes» (3.5), validar el lector
de BBVA con un PDF real (pendiente en `CUADRA.md`; aceptar una vista previa
manda datos de ese lector a conciliación, así que no se confía en él con datos
reales hasta entonces).

## Tareas

- [x] **T1 — Migración y saldos.** RED primero: pruebas de integración de que
  `rechazada` es válido en `ck_cargas_estado`, de que el PDF guardado persiste
  `saldo_inicial`/`saldo_final`, y de que `cuadra_app` puede borrar de la zona
  de espera solo de su empresa. Espejo del estado y prueba de deriva.
- [x] **T2 — Vista previa (GET).** Movimientos leídos (fecha, monto,
  referencia), total y saldos; solo de la empresa; 404 si la carga no está en
  `pendiente_vista_previa`.
- [x] **T3 — Aceptar.** Candado de empresa, `INSERT … SELECT` a `movimientos`,
  vaciar la espera, carga `procesada` con contadores que cuadran, conciliar y
  encolar sugerencias, bitácora. Sin movimientos a medias si algo falla.
- [x] **T4 — Rechazar.** Carga `rechazada`, espera vaciada, nada en
  `movimientos`, bitácora. Un 403 para quien no puede cargar, en aceptar y
  rechazar.
- [x] **T4b — Volver a subir un PDF rechazado y saldos nulos.** Un PDF
  rechazado en la vista previa se puede subir otra vez: se reabre la misma
  carga (el índice único se queda). El DTO de la vista previa admite saldos
  nulos.
- [x] **T5 — Mockup.** Artboard «18 · Vista previa del PDF» en Claude Design
  (`VistaPrevia.dc.html`) y cambios en Cargas (enlace «Revisar vista previa»,
  estado `rechazada` ámbar). Acordado con el usuario el 2026-10-29.
- [x] **T6 — Frontend.** Pantalla de vista previa según el mockup acordado.
- [ ] **T7 — Cierre.** [x] Suites completas, lint y formato; [x]
  `docs/bitacora.md`; [x] `CUADRA.md`; [ ] KAN-133 y PRs en cadena.

## Aceptación

- La vista previa muestra movimientos, total y saldos de una carga en espera.
- Aceptar pasa los movimientos a `movimientos`, deja la carga `procesada` y
  arranca la conciliación; rechazar deja la carga `rechazada` y no entra nada.
- Mientras nadie acepta, los movimientos no salen en la bandeja ni se concilian.
- Sin permiso de cargar: 403 y acceso denegado en bitácora.
- Toda tabla o columna nueva respeta `company_id`, RLS con FORCE y GRANTs.

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en migraciones, cargas, conciliación y frontend |
| T1-T4 | delegada (escritor único) | 2+ archivos no triviales: migración, servicio, controlador, pruebas |

## Progreso

- 2026-10-29: documento creado, rama abierta. Decisiones 1 y 2 acordadas.
  Siguiente: T1.
- 2026-10-29 T1: migración `VistaPreviaDecidida1790710300000` (estado
  `rechazada`, `saldo_inicial`/`saldo_final` NUMERIC(18,4) nulos, `GRANT DELETE`
  en `movimientos_pendientes`; `UPDATE` en `cargas` e `INSERT` en `movimientos`
  ya existían desde AislamientoRls). Saldos guardados al guardar el PDF
  (`guardarSaldosDeCarga`). Espejo en `tipos.ts`, frontend (tipos, etiquetas,
  fases, tonos y `MUESTRA_CONTADORES` de `FilaCarga.tsx`, una línea forzada por
  el `Record` exhaustivo). RED observado: 3 pruebas en
  `movimientos-pendientes.integracion.spec.ts` (ck_cargas_estado, columnas
  inexistentes, `permission denied` en DELETE), el de saldos en
  `estado-cuenta-pdf.integracion.spec.ts` y 4 del frontend. GREEN: 3 suites
  backend (72 pruebas), frontend 280 archivos / 4533 pruebas, typecheck, lint
  y formato. Tono/avance de `rechazada`: neutral/vacia, provisional hasta el
  mockup (T5).
- 2026-10-29 T2: `GET /cargas/:id/vista-previa` (`cargas.ver`) en
  `VistaPreviaService.consultar`; respuesta `VistaPreviaDto` (cargaId, archivo,
  banco, `total` = número de movimientos, saldos y movimientos fecha/monto/
  referencia, montos como texto NUMERIC). 404 si no existe, es ajena o no está
  en `pendiente_vista_previa`. RED: 5 de 8 pruebas fallan con 404 de ruta
  inexistente (las 3 de 404 pasaban por la misma razón equivocada); GREEN 8/8.
- 2026-10-29 T3: `POST /cargas/:id/aceptar` (`cargas.cargar`, 200) en
  `VistaPreviaService.aceptar`, en la transacción de la petición: candado AD-19,
  carga `FOR UPDATE`, `INSERT … SELECT` (cuenta lo movido y exige que cuadre con
  `total_registros`, si no revierte), espera vaciada, carga `procesada` con
  `registros_ok = n`, bitácora `confirmar` sobre `cargas` (acción propia: no
  reutiliza `cargar`, que marcaría `reanudada`). `conciliar` y
  `sugerencias.encolar` van en `alConfirmar`, sin fallar la respuesta. 404 si no
  existe/ajena, 409 si no está en espera (segunda aceptación incluida). RED: 10
  de 18 fallaban con 404 de ruta inexistente; GREEN 18/18, incluidas dos
  aceptaciones simultáneas (200+409) y un fallo a mitad del INSERT (500, nada
  movido).
- 2026-10-29 T4: `POST /cargas/:id/rechazar` (`cargas.cargar`, 200) en
  `VistaPreviaService.rechazar`: carga `FOR UPDATE` (serializa con aceptar sin
  tomar el candado de empresa, porque no toca conciliación), espera borrada,
  carga `rechazada`, bitácora `rechazar` sobre la carga con
  `movimientosDescartados`. 404/409/400 como aceptar; 403 con `acceso_denegado`
  para quien no tiene `cargas.cargar` en ambos. Pruebas: mientras espera, la
  bandeja y `conciliar` no ven nada (T3). RED: 8 de 26 con 404 de ruta
  inexistente; GREEN 26/26 (aceptar y rechazar simultáneos: 200+409).
- 2026-10-29 Cierre de T1-T4: la suite completa detectó una lista cerrada de
  tablas con `DELETE` para `cuadra_app` (`sesiones-privilegios`); se agregó
  `movimientos_pendientes` a propósito. Suite backend completa: 69 suites, 1477
  pruebas en verde; frontend 280 archivos / 4533 pruebas. Siguiente: T5
  (mockup, bloquea T6).
- 2026-10-29 T4b: decisión A: `guardarEstadoCuentaPdf` reabre una carga
  `rechazada` con el mismo hash (`reabrirCargaRechazada`: `UPDATE … WHERE estado
  = 'rechazada' RETURNING`, con total nuevo; los saldos los refresca
  `guardarSaldosDeCarga`), vuelve a llenar la espera, bitácora `cargar` con
  `resubida: true` y responde `yaExistia: false`. Con subidas simultáneas la
  perdedora espera el candado de fila, ya no ve `rechazada` y responde como
  carga existente. Los demás estados conservan `yaExistia: true`. Sin
  migración: `cuadra_app` ya tenía `UPDATE` en `cargas` e `INSERT` en
  `movimientos_pendientes`. Decisión B: `VistaPreviaDto.saldoInicial/saldoFinal`
  son `string | null` (y nullable en Swagger); no hay tipo espejo en el
  frontend. RED: 4 de 6 pruebas nuevas fallaban (carga seguía `rechazada` y
  `yaExistia: true`); la de saldos nulos ya pasaba en ejecución (el cambio es
  de tipo). Una trampa vista: `manager.query` de un `UPDATE … RETURNING`
  responde `[filas, n]`.
- 2026-10-29 T5: mockup creado en el canvas, con la propiedad `vista` para sus estados y `rol` (revisor = solo consulta); sin tema claro (Cargas tampoco lo tiene); aceptar sin diálogo, rechazar con confirmación. Acordado. Siguiente: T6.
- 2026-10-29 T6: frontend en tres commits (`9c882af`, `4551779`, `23b3d24`).
  (1) `rechazada` pasa a tono `sin_match` y avance `naranja` (ámbar del
  mockup); contratos `vistaPreviaCarga` y `respuestaDecisionVistaPrevia` (montos
  como cadenas), clave `clavesCargas.vistaPrevia`, `useVistaPrevia`,
  `useDecidirVistaPrevia` (guarda de doble disparo y de época; invalida
  historial y detalle, y la bandeja solo al aceptar; no la vista previa misma)
  y `montoConSigno`/`saldoVista` sobre `formatearMonto`. (2) Pantalla
  `features/vista-previa` (contenedor + componentes presentacionales) con los
  estados del mockup 18: cargando, 404, 409 (de la lectura o de la acción), 403,
  fallo de conexión con «Reintentar», error del servidor, solo consulta,
  aceptando/rechazando, alertdialog de rechazo, banners verde y ámbar, sin
  saldos; el foco va al banner, a la alerta y de vuelta a «Rechazar» al
  cancelar. (3) «Revisar vista previa» en la tarjeta del PDF (solo si el estado
  es `pendiente_vista_previa`) y en la fila de la tabla; ruta
  `/cargas/:cargaId/vista-previa` dentro del shell (Cargas queda activa). RED
  observado en cada unidad (imports sin resolver, contratos indefinidos, tono
  `neutral` vs `sin_match`, enlaces ausentes). GREEN: frontend 287 archivos /
  4627 pruebas, typecheck, lint, `format:check` y build. Pendiente fuera de la
  superficie de T6: `frontend/tests/dominio/cargasEspejo.test.ts` espera 3
  `@Permiso('cargas.cargar')` y el controlador ya tiene 5 (aceptar y rechazar,
  T3-T4): falla desde antes de T6, queda para T7. Siguiente: T7.
- 2026-10-29: R3-001/R3-002 (revisión): un corte de red al aceptar o rechazar
  ya no dice «No se aceptó/rechazó nada»; clase `red` con «No pudimos
  confirmar el resultado.» y enlace «Ir a Cargas». Abrir la confirmación de
  rechazo limpia el error anterior.
- 2026-10-29 T7: verificación completa: backend `npm test` 69 suites / 1483 pruebas, typecheck, build, eslint y prettier limpios; frontend vitest 287 archivos / 4633 pruebas, typecheck, lint, `format:check` y build limpios. Prueba del reset del error previo reforzada (`d3f9ab8`): asevera la alerta de aceptar antes y su ausencia después; RED observado quitando `decision.reset()` (falla «expected document not to contain element, found <div…»), código restaurado. Bitácora y `CUADRA.md` al día. Faltan KAN-133 y los PRs (decide el padre).
