# Historia 5.1: Ver la bandeja ordenada por confianza

Rama: `feat/v2-5-1-bandeja-por-confianza`
Jira: KAN-144 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 5.1, UX-DR6)
Spine: AD-4, AD-2
PRD: FR-17
Mockup: `Bandeja.dc.html` y `BandejaClaro.dc.html`, actualizados y acordados el 2026-11-05
Mirror Engram: `odd/v2-5-1-bandeja-por-confianza/tasks`
Runner: backend `npm test -- <spec>`; frontend `npx vitest run <archivo>`

## Objetivo

La bandeja lista los casos pendientes con las propuestas más seguras arriba y señala
con su motivo las decisiones que requieren revisión.

## Specs

- S1: «ordenados por confianza (regla 1, luego regla 2, luego regla 3; los depósitos con
  varias facturas después de la regla 1)». Orden acordado en el mockup: regla 1
  (`referencia_monto_exacto`), depósito con varias facturas (`suma_grupo`), regla 2
  (`referencia_monto_diferente`), regla 3 (`monto_unico`), sugerencia de IA
  (`llm_sugerencia`), sin match, y al final los conciliados normales. Dentro de cada
  rango, monto de mayor a menor y luego `id`. Reemplaza el orden por monto (pruebas S15
  y S16 y el texto «Orden: monto ↓»).
- S2: «aparece señalada de forma visible con el motivo de la revisión». Decisión del
  usuario: el motivo sale de la factura cancelada, sin migración. La API expone un
  código estable `cfdi_cancelado` solo si la decisión tiene `requiere_revision` Y al
  menos una de sus facturas está `cancelada`; si no, `null` y la fila queda con el chip
  sin motivo. El texto «Motivo: la factura se canceló» vive en el frontend.
- S3: «un movimiento con una decisión vigente o con una carga en `pendiente_vista_previa`
  [...] no aparece como pendiente». La exclusión ya existe; falta la prueba de bandeja
  para la carga.
- S4: «un caso sin propuesta [...] conserva su motivo estable de "sin propuesta" y sus
  candidatos, si los hay». El motivo ya se conserva; los candidatos de un `sin_match`
  no salen en la bandeja. Pendiente de verificar si el detalle del caso los muestra.
- S5: «una persona de otra empresa [...] no ve ningún caso de la empresa ajena» y «un
  monto largo [...] nunca se parte en dos líneas»: ya cumplidos y con pruebas.

## Tasks

- [ ] T1 (S1) backend: ordenar `listar` por confianza — inline
- [ ] T2 (S2) backend: `motivoRevision` en la fila de la bandeja — inline
- [ ] T3 (S1, S2) frontend: contrato, textos, fila y orden — inline
- [ ] T4 (S3) prueba de bandeja: carga en `pendiente_vista_previa` — inline
- [ ] T5 (S4) verificar candidatos del sin match en el detalle del caso — inline
- [ ] T6 bitácora y `CUADRA.md`

## Log

- L1 (2026-11-05): «empezemos con la 5.1 esto es una nueva epic por lo que veo»
- L2 (2026-11-05): «sí, vamos con B con esa salvaguarda» (motivo derivado de la factura
  cancelada, sin migración; solo se muestra si el CFDI está `cancelada`)
- L3 (2026-11-05): «si esta bien» (mockup actualizado, con la IA después de la regla 3 y
  los sin match al final)
- Ruta: todo inline; ninguna tarea tiene un motivo de escritor delegado. Si T2 toca
  `bandeja.dto.ts` es adición de un campo, no cambio de contrato existente.
