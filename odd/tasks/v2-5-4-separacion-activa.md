# Historia 5.4: Separación de funciones activa por defecto

Rama: `feat/v2-5-4-separacion-activa`
Jira: KAN-147 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 5.4, FR-22)
Spine: AD-13
Mirror Engram: `odd/v2-5-4-separacion-activa/tasks`
Runner: backend `npm test -- <spec>`
Entrega: `ask-on-risk`; pronóstico ~250 líneas, un solo PR. Inicio 2026-11-05.

## Specs

- S1: «recibe 403 con un mensaje claro y no cambia nada» (separación activa, carga propia).
- S2: «`companies.separacion_funciones` es `true` por defecto» y «si la configuración falta o su
  lectura falla, se aplica la separación (falla cerrada)». Solo un `false` explícito la desactiva.
- S3: «esas se excluyen como se describe en la historia 5.3» (lote). La bandeja marca
  `bloqueada` con la misma decisión que la confirmación.
- S4: «cubren los dos modos, separación activa y desactivada, y el caso de configuración ausente».

## Tasks

- [x] T1 (S1-S4, inline, commit en la rama): helper `separacionActiva` con falla cerrada (SAVEPOINT), usado por
  `ResolucionService` (lote: una lectura) y `BandejaService`. Pruebas de los dos modos y config ausente.

## Log

- L1 (2026-11-05): «hay que continuar» (retomar tras cerrar 5.3; sigue la 5.4).
- Mapa del explorador: la columna existe y nadie la lee; `companies` sin RLS y `cuadra_app` solo
  SELECT → filtrar `WHERE id = companyId`; un error SQL aborta la transacción → SAVEPOINT.
- T1 hecha: suite completa 1899 pruebas verdes; mutación (helper siempre true) rompe 4. Risk: none (la regla se conserva en modo activo; contrato sin cambios).
