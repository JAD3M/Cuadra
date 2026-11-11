# Historia 6.1: Registrar lo que Cuadra habría cerrado sola

Rama: `feat/v2-6-1-evidencia-sombra` (un solo PR; las notas de cierre van dentro del PR)
Jira: KAN-153 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 6.1, FR-34, FR-38)
Spine: AD-3, AD-10, AD-2
Mirror Engram: `odd/v2-6-1-evidencia-sombra/tasks`
Runner: backend `npm test -- <spec>` (Docker arriba); frontend `npx vitest run <archivo>`
Entrega: `ask-on-risk`; un PR (menos de 400 líneas de código). Inicio 2026-11-10.

## Specs

- S1: «el motor crea una propuesta de la regla 1 con candidata única, sin tolerancia ni ambigüedad» «se inserta una fila en `evidencia_sombra` con `evento = habria_cerrado`, la empresa, el banco, la decisión y la fecha».
- S2: «una propuesta de las reglas 2 o 3, o un depósito con varias facturas» «no se registra, porque nunca entran a la etapa 2».
- S3: «`cuadra_app` solo puede hacer `SELECT` e `INSERT`, y la fila lleva `company_id` con RLS (clase 1)».
- S4: «el insert ocurre en la misma transacción que la propuesta, para no perder evidencia, y no cambia el estado de nada».
- S5: «Una empresa nueva» «cargue su primer mes» «el registro empieza desde la fase 2a, aunque las pantallas lleguen en la fase 3» (sin interruptor por empresa: el registro es incondicional desde la migración).
- S6: «el nuevo valor `habria_cerrado`» «se registra en `tipos.ts`, en su espejo del frontend, en el `CHECK` y en la prueba de deriva».
- Supuesto A1: «sin tolerancia» = `diferencia_monto = 0` además de la regla `referencia_monto_exacto` (la regla 1 también sale con diferencia dentro de la tolerancia).
- Supuesto A2: solo `habria_cerrado` en esta historia; `confirmo`, `rechazo`, `desmarco` y `reabrio` los agrega la 6.2 con su CHECK.
- Supuesto A3: `banco` es nullable (`movimientos.banco` lo es); la fecha es `created_at`; `persona_id` nullable (la 6.2 lo usa; `habria_cerrado` no tiene persona).
- Supuesto A4: índice único parcial por `decision_id` con `evento = 'habria_cerrado'`: una decisión no registra dos veces.
- Supuesto A5: sin módulo `sombra/` con servicio todavía; la entidad vive en `src/sombra/` y el insert va en la sentencia del motor (`conciliacion.service.ts` `insertar`).

## Tasks

- [ ] T1 (S1-S6, backend, inline; Risk item 2: tabla de dominio nueva con RLS y GRANTs, y el CTE central del motor): migración, entidad, registros, `EVENTOS_SOMBRA` en `tipos.ts` y espejo, CTE en `insertar`, pruebas.
- [ ] T2 (cierre dentro del PR): notas en `CUADRA.md` y `docs/bitacora.md`, repaso en Engram.

## Log

- L1 (2026-11-10): «ah si. es que ahi cerramos la epica 5 y seguimos con la 6 y empezamos con 6.1».
- Mapa del explorador: regla 1 = `referencia_monto_exacto` (score 1.0); la ambigüedad de referencia ya se rechaza antes de crear la propuesta (`referencia_ambigua`); las propuestas se insertan con un CTE en `insertar` (`conciliacion.service.ts:240-295`) con `cabeceras ... ON CONFLICT DO NOTHING RETURNING`, ancla correcta para no duplicar evidencia; `insertarGrupos`, las sugerencias del LLM y el descarte no deben registrar; `movimientos.banco` existe y es nullable; no hay `src/sombra` ni prueba de arquitectura que lo impida; la última migración es `1790718000000`.
