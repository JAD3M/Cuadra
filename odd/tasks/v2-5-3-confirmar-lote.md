# Historia 5.3: Confirmar un lote con la regla 1 ya marcada

Rama: `feat/v2-5-3-confirmar-lote`
Jira: KAN-146 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 5.3, UX-DR6)
Spine: AD-4, AD-7, AD-19
PRD: FR-18, FR-19, FR-31
Mockup: `Bandeja.dc.html` y `BandejaClaro.dc.html` (la confirmación en lote NO está dibujada: se actualiza y se acuerda antes del frontend)
Mirror Engram: `odd/v2-5-3-confirmar-lote/tasks`
Runner: backend `npm test -- <spec>`; frontend `npx vitest run <archivo>`
Entrega: `ask-on-risk`; pronóstico ~700 líneas, en cadena de 3 PR (T1, T2, T3-T4). Fecha de inicio 2026-11-05.

## Objetivo

La persona confirma de una vez las propuestas más seguras (regla 1 marcada), desmarca las
que no la convencen, y cada confirmación queda ligada a un `lote_id`, con persona, fecha y
regla. Solo una persona cierra un caso; el motor y la IA nunca.

## Specs

- S1: «solo las propuestas de la regla 1 vienen marcadas, y las de las reglas 2 y 3 y los
  depósitos con varias facturas vienen desmarcados». Regla 1 = `referencia_monto_exacto`;
  depósito con varias facturas = `suma_grupo`. Una sugerencia de la IA nunca viene marcada
  (epics.md, 4.7: «nunca viene marcada para el lote y nunca se cierra sola»).
- S2: «se confirman solo las marcadas, todas con el mismo `lote_id`, y cada una queda con
  persona, fecha y regla». «el lote no pide un motivo».
- S3: «esa propuesta se omite, las demás se confirman y la respuesta informa cuántas se
  omitieron y por qué».
- S4: «aparece desmarcada y deshabilitada con el motivo» (propuesta que la separación de
  funciones impide confirmar a esta persona, al armar el lote).
- S5: «no ve la confirmación en lote» (persona con rol `auditor` al abrir la bandeja).
- S6: «queda un identificador de lote y una entrada de bitácora por confirmación».

Supuestos (míos, a confirmar con el usuario si algo no cuadra):
- A1: se reutiliza el permiso `conciliaciones.resolver` (ya excluye `auditor`); no se
  agrega permiso nuevo.
- A2: cada confirmación reutiliza la acción de bitácora `confirmar`, con `loteId` en
  `datos`; no se cambia el CHECK de acciones.
- A3: «se consulta» = el `lote_id` en la decisión y en su bitácora; no hay GET de lote.
- A4: tope de 500 ids por lote, constante con nombre.
- A5: la separación de funciones sigue siempre activa como hoy; el interruptor por empresa
  (`companies.separacion_funciones`) es la 5.4.
- A6: el servidor acepta cualquier id que la persona marque (también regla 2 o 3 o un
  grupo); lo único que cambia es qué viene marcado de inicio. Lo que la separación de
  funciones prohíbe se omite con su razón aunque el cliente lo mande marcado.

## Tasks

- [x] T1 (S4): regla de separación de funciones en un solo lugar
  (`src/common/separacion-funciones.ts`: fragmento SQL + `subioAlgunaCarga`, que no lanza ni
  escribe `acceso_denegado`), usada por la confirmación individual y por la bandeja; la
  bandeja expone `motivoBloqueo` (`separacion_de_funciones` o `null`, depende de quien
  consulta) por fila, con espejo y contrato en el frontend. Sin `puedeConfirmar`: `null`
  significa que puede. Ruta: inline. PR 1. RED: 6 pruebas BJ-2e fallaron por el campo
  ausente. Commit: ver PR de T1.
- [ ] T2 (S2, S3, S5, S6): `POST /conciliaciones/lotes` con `{ ids }` (no `/lote/confirmar`: chocaría con `/:id/confirmar`): candado de
  empresa, `lote_id` único, omitidas con razón, una bitácora `confirmar` por decisión con
  `loteId`. Alto riesgo (item 4, bloqueos): verificador independiente. Ruta: inline. PR 2.
  Commit: —
- [ ] T3 (S1, S4, S5): mockup de la confirmación en lote (Bandeja oscuro y claro), acordado
  con el usuario antes del código. Ruta: inline. Commit: —
- [ ] T4 (S1-S6): frontend: modo lote en la bandeja (casillas, deshabilitadas con motivo,
  resumen de omitidas), oculto sin `conciliaciones.resolver`. Ruta: inline. PR 3. Commit: —
- [ ] T5: documentación (`CUADRA.md`, bitácora), repaso y cierre de la historia. Commit: —

## Log

- L1 (2026-11-05): «arranca con ella» (la historia 5.3, tras cerrar los pendientes de la
  4.6; contexto: el usuario dijo antes «vamos con lo que necesitan mockup» y «aprobado»
  solo para los mockups ya mostrados).
- L2 (2026-11-05): un explorador mapeó la 5.3: solo existe `decisiones.lote_id` (nadie lo
  escribe; `resolucion-grupo.integracion.spec.ts:505-538` lo afirma nulo), la confirmación
  individual (`ResolucionService.confirmar`, una sola sentencia que lanza 409/403) y
  `exigirSegregacion` (lanza 403, escribe `acceso_denegado`, ignora
  `companies.separacion_funciones`). Sin endpoint de lote, sin permiso de lote, sin UI.
- L3 (2026-11-05): T1 hecha y commiteada en local (92855ad documento, 1e92876 código).
  Backend 1856 y frontend 4771 pruebas verdes. El push se rechaza desde GitHub con
  `fatal error in commit_refs_rules` (probado: rama completa, solo el primer commit, otro
  nombre de rama; sin rulesets ni protección). No es contenido ni nombre. PR de T1 pendiente
  de abrir cuando el push pase.
