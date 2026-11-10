# Historia 5.8: Reabrir un lote completo

Rama: `feat/v2-5-8-backend` (cadena: backend, frontend)
Jira: KAN-151 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 5.8, FR-32, FR-33)
Spine: AD-4, AD-19
Mirror Engram: `odd/v2-5-8-reabrir-lote/tasks`
Runner: backend `npm test -- <spec>` (Docker arriba); frontend `npx vitest run <archivo>`
Entrega: `ask-on-risk`; cadena de PR. Todo lo que el frontend espeja de una lista del backend (razones de omisión) va en el MISMO PR que el cambio de `tipos.ts`. Inicio 2026-11-10.

## Specs

- S1: «un lote con varias confirmaciones vigentes» que reabre «un `admin` o quien lo confirmó» «con
  un solo motivo»: «todas sus decisiones que sigan `confirmada` pasan a `reabierta` en una sola
  transacción, con los ids en orden ascendente».
- S2: «casos del lote que ya se habían reabierto o reconfirmado» «se omiten y la respuesta informa
  cuántos fueron y por qué».
- S3: «queda una entrada por caso reabierto, con el mismo motivo y el identificador del lote».
- S4: «una persona sin permiso de reabrir» que intenta reabrir un lote «recibe 403 y queda un acceso
  denegado».
- S5: «una falla a la mitad»: «no se reabre ningún caso del lote y el motivo se muestra».
- S6 (decisión del usuario, 2026-11-10): botón «Reabrir lote» en el resultado de «Confirmar lote»
  de la bandeja, con motivo obligatorio. Mockups 2 y 7 se acuerdan ANTES del código.
- Supuesto A1: ruta `POST /conciliaciones/lotes/:loteId/reabrir {motivo}`; respuesta
  `{ loteId, reabiertas: string[], omitidas: [{id, razon}] }`, igual que la del lote de 5.3.
- Supuesto A2: razones de omisión nuevas `ya_reabierta`, `reconfirmada` (la factura o el movimiento
  ya tienen otra confirmación vigente) y `no_confirmada` (cualquier otro estado).
- Supuesto A3: una persona que no es admin solo reabre un lote si confirmó TODAS sus decisiones;
  si no, 403 más acceso denegado (sin efecto parcial). Un lote inexistente o de otra empresa es 404.
- Supuesto A4: índice `(company_id, lote_id)` parcial en `decisiones`: hoy buscar un lote es un scan.

## Tasks

- [x] T1 (S1-S5 backend + espejo mínimo del frontend, inline; Risk item 4 y 5: reapertura masiva concurrente bajo candado y migración de índice): migración (índice), razones nuevas en `tipos.ts` y su espejo, `POST /conciliaciones/lotes/:loteId/reabrir`, servicio transaccional, pruebas incluida concurrencia y falla a la mitad.
- [~] T2 (mockup, S6; publicado el 2026-11-10 en el canvas v153, falta aprobación; números 2 y 7): «Reabrir lote» en el resultado del lote (bandeja, mockups 2 y 7). Acordar con el usuario ANTES del código.
- [ ] T3 (frontend, S5-S6): guardar el `loteId` del resultado, botón y formulario de motivo, hook, contrato, resultado de la reapertura con omitidas y razones, error visible.

## Log

- L1 (2026-11-10): «sí, sube la rama y abre el PR, y arranca la 5.8».
- L2 (2026-11-10): «la 1, con el botón en el resultado del lote».
- Mapa del explorador: `lote_id` es una columna uuid sin índice ni tabla `lotes`, generada por
  `confirmarLote` con `uuidv7()`; la reapertura (5.7) no la limpia y una reconfirmación crea una
  decisión nueva; no hay pantalla que muestre un lote y `ResultadoLote` descarta el `loteId`;
  `RAZONES_OMISION_LOTE` está espejada a mano en el frontend; ningún spec prueba una falla a la
  mitad (hay que inyectarla).
- T1 hecha (inline, una unidad): migración 1790717000000 (índice parcial `(company_id, lote_id)`), `RAZONES_OMISION_REAPERTURA` en `tipos.ts` con su espejo y etiquetas en el frontend (y el conteo de listas de `deriva.test.ts` de 19 a 20), `POST /conciliaciones/lotes/:loteId/reabrir`, `ReabrirService.reabrirLote` (candado, decisiones por id, CFDI por id, movimientos por id, una sentencia para todo el lote, `conciliar()` una vez). 14 pruebas de integración nuevas, con la falla a la mitad inyectada (movimiento inconsistente: 409 y nada cambia) y la concurrencia. Sin RED previo: el código se escribió antes que la prueba. Backend 1966 y frontend 4951 verdes. Risk: item 4 (reapertura masiva concurrente bajo candado) y item 1 (migración de un índice sobre una tabla existente).
- T2 publicada: mockups 2 y 7 (Bandeja oscuro y claro) con «Reabrir lote» en el resultado del lote, formulario de motivo obligatorio, resultado «Lote reabierto: N casos.» con omitidas y razones, y aviso «No se reabrió ningún caso.» si falla; vistas `lote_reabriendo`, `lote_reabrir_sin_motivo`, `lote_reabierto`, `lote_reabrir_falla`. Pendiente la aprobación del usuario.
