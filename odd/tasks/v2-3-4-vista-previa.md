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
- [ ] **T2 — Vista previa (GET).** Movimientos leídos (fecha, monto,
  referencia), total y saldos; solo de la empresa; 404 si la carga no está en
  `pendiente_vista_previa`.
- [ ] **T3 — Aceptar.** Candado de empresa, `INSERT … SELECT` a `movimientos`,
  vaciar la espera, carga `procesada` con contadores que cuadran, conciliar y
  encolar sugerencias, bitácora. Sin movimientos a medias si algo falla.
- [ ] **T4 — Rechazar.** Carga `rechazada`, espera vaciada, nada en
  `movimientos`, bitácora. Un 403 para quien no puede cargar, en aceptar y
  rechazar.
- [ ] **T5 — Mockup.** Crear el mockup de la vista previa en Claude Design y
  acordarlo con el usuario. Bloquea T6.
- [ ] **T6 — Frontend.** Pantalla de vista previa según el mockup acordado.
- [ ] **T7 — Cierre.** Suites completas, lint y formato, `docs/bitacora.md`,
  `CUADRA.md`, KAN-133, PRs en cadena.

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
