# Historia 6.2: Registrar qué hizo la persona después

Rama: `feat/v2-6-2-desacuerdo-sombra` (desde master f4e8edc; notas de cierre dentro del último PR)
Jira: KAN-154 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 6.2, FR-35)
Spine: AD-10, AD-4, AD-12
Mirror Engram: `odd/v2-6-2-desacuerdo-sombra/tasks`
Runner: backend `npm test -- <spec>` (Docker arriba); frontend `npx vitest run <archivo>`
Entrega: `ask-on-risk`; PR en cadena solo si pasa de ~400 líneas de código y es separable. Inicio 2026-11-11.

## Specs

- S1: «una persona la confirma, la rechaza, la desmarca en un lote o la reabre más tarde» «se inserta una nueva fila de `evidencia_sombra` con el evento `confirmo`, `rechazo`, `desmarco` o `reabrio`, la persona y la fecha». Solo para propuestas de la regla 1 «con evidencia registrada» (que ya tienen fila `habria_cerrado`).
- S2: «nunca se actualiza ni se borra una fila anterior».
- S3: «una propuesta que la persona desmarcó y luego resolvió de otra forma» «cuenta como desacuerdo».
- S4: «una propuesta que la persona desmarcó y luego confirmó igual» «no cuenta como desacuerdo».
- S5: «un rechazo o una reapertura» «cuentan como desacuerdo».
- S6: «se calcula con una consulta sobre los eventos y no se guarda en una tabla»; «una prueba cubre cada uno de los casos anteriores con datos de dos empresas».
- S7: «los nuevos valores `confirmo`, `rechazo`, `desmarco` y `reabrio`» «se registran en `tipos.ts`, en su espejo, en el `CHECK` y en la prueba de deriva».
- Supuesto A1 (aprobado por el usuario, 2026-11-11: «sí, agrégalo»): `POST /conciliaciones/lotes` recibe un campo opcional nuevo `desmarcadas: string[]` con las propuestas que venían marcadas y la persona desmarcó; el frontend lo envía. Sin cambio visual, sin mockup.
- Supuesto A2: una id presente a la vez en `ids` y en `desmarcadas` se rechaza con 400 (entrada contradictoria). Una desmarcada sin fila `habria_cerrado`, de otra empresa o que ya no está en `propuesta` se ignora sin error y sin registrar.
- Supuesto A3: los eventos son solo-agregar. No se agrega índice único nuevo: `desmarco` puede repetirse sobre la misma decisión en lotes distintos; la tasa cuenta por decisión (`DISTINCT`).
- Supuesto A4: la tasa se calcula por decisión con `habria_cerrado` (denominador). Desacuerdo = tiene `rechazo` o `reabrio`, o tiene `desmarco` y no tiene `confirmo`. Una re-propuesta tras reabrir crea decisión nueva con su propia `habria_cerrado`; la tasa por movimiento se obtiene con `COUNT(DISTINCT movimiento_id)` vía `decisiones`.
- Supuesto A5: la tasa vive en un servicio de consulta en `src/sombra/`; sin endpoint ni pantalla en esta historia (nadie los pidió).
- Supuesto A6: la hermana `obsoleta` de una confirmación no es un rechazo humano y no se registra.

## Tasks

- [x] T1 (hecha, sin commit aún; RED: el CHECK solo traía `habria_cerrado`, 12 pasan y 1 falla; GREEN: 86 pruebas de sombra, esquema y RLS) (S7; backend, inline; Risk item 2: cambia el CHECK de una tabla con RLS): migración `1790720000000` que reescribe `ck_evidencia_sombra_evento` con los 5 valores, `EVENTOS_SOMBRA` en `tipos.ts` y espejo, prueba de deriva y del CHECK.
- [x] T2 (hecha, sin commit aún; RED: 5 de 7 fallan sin el CTE; GREEN: 7 nuevas y 492 en resolucion, sombra y conciliacion; CTE `sombra` en `confirmarUna`, `rechazar`, `reabrir`, `reabrirLote`; spec `src/sombra/decisiones-de-la-persona.integracion.spec.ts`) (S1, S2, S5; backend, inline; Risk item 2: toca las sentencias que cierran y reabren casos): CTE `sombra` hermano de `auditoria` en `confirmarUna`, `rechazar`, `reabrir` y `reabrirLote`, con JOIN a `habria_cerrado`; pruebas con dos empresas y atomicidad.
- [x] T3 (hecha; RED: 3 de 12 fallan sin el campo; GREEN: `desmarcadas` en `LoteDto`, 400 si una id va en ambas, `anotarDesmarcadas` en `confirmarLote`; 218 pruebas de sombra y resolucion) (S1, S3; backend, inline; Risk item 3: se agrega un campo opcional a un contrato que otros consumen, sin romper el actual): `desmarcadas` en `LoteDto` y registro de `desmarco` en `confirmarLote`.
- [x] T4 (hecha; SIN RED observado: el código se escribió antes que las pruebas; 236 de bandeja y 5035 del frontend verdes; sin cambio visual) (A1; frontend, inline): `BandejaPage` calcula las desmarcadas contra `marcadasIniciales`, `useConfirmarLote` las envía; pruebas.
- [x] T5 (hecha; RED: el módulo no existía, 8 de 8 fallan; GREEN: 8 pruebas con dos empresas; `SombraService.tasaDesacuerdo` + `SombraModule` en `AppModule` y en la app de pruebas) (S3-S6; backend, inline): servicio de tasa de desacuerdo como consulta sobre eventos; una prueba por caso con datos de dos empresas.
- [x] T6 (verificador independiente sin blockers; notas en `CUADRA.md` y `docs/bitacora.md`; repaso en Engram): notas de cierre en `CUADRA.md` y `docs/bitacora.md`, repaso en Engram, verificador independiente al final.

## Log

- L1 (2026-11-11): «continuemos hora si donde lo dejamos»
- L2 (2026-11-11): «sí, agrégalo y arranca con el documento ODD» (respuesta a: ¿agregamos un campo opcional `desmarcadas: string[]` a `POST /conciliaciones/lotes` y hacemos que el frontend lo envíe?).
- Mapa del explorador: todos los cambios de estado son CTE de una sola sentencia; el patrón es un CTE `sombra` que inserta desde el `RETURNING` con JOIN a `habria_cerrado`. Anclas: `confirmarUna` (`resolucion.service.ts:236-337`, `$3` = `quien.userId`; `confirmarLote` la llama dentro de `SAVEPOINT item_de_lote`, así el rollback deshace también la evidencia), `rechazar` (`:366-394`), `reabrir` (`reabrir.service.ts:132-183`), `reabrirLote` (`:324-380`). `decisiones` no tiene `banco`: se toma de `movimientos.banco` (`conciliacion.service.ts:289-295`). `LoteDto` en `dto/resolucion.dto.ts` (~66-86, `MAXIMO_LOTE=500`). Frontend: `BandejaPage.tsx` (~100-170), `lote.ts:46` `marcadasIniciales`, `useConfirmarLote.ts:35-41`. Último migration `1790719000000`. Alerta: el índice único parcial `ux_evidencia_sombra_habria_cerrado` solo cubre `habria_cerrado`; los eventos nuevos quedan fuera (por eso A3).
- Reglas vigentes: sin push, PR ni integración sin sí explícito; verificador independiente en el sitio, sin copiar `.env`; RED pegado; specs de integración truncan `evidencia_sombra` y bitácora; `git rebase --autostash`.
- Supuesto A7 (T5, REEMPLAZADO por el Log del 2026-11-11: la desmarcada pendiente espera su resolución): la tasa es `desacuerdos / tratadas` (cuatro decimales, `null` sin tratadas); una propuesta que nadie tocó no diluye la tasa pero sí cuenta en `propuestas`. `desmarco` sin `confirmo` cuenta como desacuerdo aunque la resolución haya sido por una vía sin evento (descarte, a mano) o siga pendiente: el sesgo es hacia el lado conservador (falso positivo peor que no conciliar). Para decidir con el usuario si la desmarcada pendiente debe contar.
- Limitación conocida (A1): `desmarcadas` solo viaja si el lote se envía con al menos una marcada (`ids` exige 1). Si la persona desmarca todo y cancela, no queda evidencia.
- Al reabrir, el motor re-propone con una decisión nueva (su propia `habria_cerrado`, sin tocar): la prueba de la tasa lo fija (propuestas 4, tratadas 3).
- Backend completo: 2045 pruebas verdes; frontend: 5035; prettier de código limpio; lint sin errores en lo tocado.
- Verificador independiente (en el sitio, sin `.env`): sin blockers, S1-S7 y A1-A7 cumplidos; 299 pruebas de sombra, resolución, esquema y RLS. Advisories: faltaba una prueba de omitida en lote (agregada), `down()` con datos sin ejecutar, `desmarcadas` no viaja si se desmarca todo, T4 sin RED.
- 2026-11-11, después del PR #128 (integrado): A7 resuelto por el usuario: «esperar la resolucion». Una desmarcada pendiente no entra en la tasa; desacuerdo si `desmarco`, resuelta (decisión fuera de `propuesta` o movimiento no abierto) y sin `confirmo`. Rama `feat/v2-6-2-a7-desmarcada-pendiente`.
