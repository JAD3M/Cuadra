# Historia 4.4: Proponer una pareja de factura y pago, con su regla y confianza

Rama: `feat/v2-4-4-pareja-factura-pago`
Jira: KAN-140 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 4.4, líneas 1125-1157)
Spine: AD-3, AD-4
Mirror Engram: `odd/v2-4-4-pareja-factura-pago/tasks`

## Objetivo

Que el contador revise parejas de factura y pago ya propuestas, sabiendo por qué
(regla) y con cuánta confianza, en vez de buscarlas a mano.

## Problema

La 4.2 dejó el motor sobre `decisiones`: las reglas 1-3, sus puntuaciones
(1.0 / 0.5 / 0.4), la tolerancia de la empresa y el bloqueo de pares rechazados
ya existen. Mapeo del 2026-11-04 contra los 6 criterios:

| AC | Estado | Evidencia |
| --- | --- | --- |
| 1 regla 1 con la puntuación más alta | hecho | `evaluar-par.ts:12-18`, specs de `evaluar-par` e integración |
| 2 reglas 2 y 3 menores, tolerancia | hecho; orden sin spec | `casos.service.ts:44` ordena por score |
| 3 CFDI no-MXN no se empata, motivo «moneda no soportada» | **falta** | hoy USD con USD empata; el texto solo existe en la carga |
| 4 par rechazado no se re-propone | hecho | `ux_decisiones_movimiento_huella_abierta`, specs |
| 5 motor e IA nunca crean `confirmada`, prueba de arquitectura | **falta la prueba** | solo el CHECK de BD |
| 6 regla y nivel de confianza visibles | **falta el nivel** | solo se expone `score` y `regla` |

## Decisiones

- 2026-11-04: los movimientos son siempre MXN (el estado de cuenta se rechaza si
  no lo es), así que el AC3 trata solo de CFDI no-MXN. Un CFDI no-MXN se excluye
  de los candidatos y su caso queda con el motivo nuevo `moneda_no_soportada`.
  Los specs que hoy esperan empate USD-USD se corrigen: eran sintéticos.
- El nivel de confianza (`alta` / `media` / `baja`) se deriva de la puntuación de
  la regla en un solo lugar; nunca se inventa en el frontend.

## Alcance autorizado

- Backend: `src/conciliacion/evaluar-par.ts` (+ spec), `src/common/entities/tipos.ts`,
  `src/casos/**`, una migración nueva para el CHECK de `regla_sin_match`,
  la prueba de arquitectura nueva en `src/conciliacion/`.
- Frontend: solo espejar los valores nuevos del backend si la pantalla del caso
  los muestra (sin cambiar distribución; el mockup manda).
- Fuera: reglas multi-factura (4.5), endurecer la clave de rechazo por huella.

## Reglas no negociables que aplican

- Toda query del dominio con `company_id`; montos `NUMERIC`, nunca flotante.
- El motor decide; la IA solo sugiere y nunca cierra un caso.
- Un falso positivo es peor que no conciliar.
- Estados, reglas y motivos salen de `tipos.ts`.

## Tareas

- [x] **T1** Moneda no soportada (AC3): motivo `moneda_no_soportada` en `tipos.ts`
  y migración del CHECK, el motor excluye CFDI no-MXN, el caso lo muestra; specs
  USD corregidos.
- [x] **T2** Nivel de confianza (AC6) y orden (AC2): `nivelDeConfianza(score)`,
  expuesto en el caso, spec de coincidencia con la puntuación y del orden.
- [x] **T3** Prueba de arquitectura (AC5): el motor y la IA no escriben `confirmada`.
- [ ] **T4** Cierre: bitácora, `CUADRA.md`, Jira KAN-140, PR y repaso.

## Rutas

Se declara por tarea al ejecutarla (inline o delegada, con su disparador).

## Verificación

Backend: `npm test` (con Postgres en 5432), `npm run lint`, `npm run format:check`.

## Progreso

T1 hecha en `5f78244`. Ruta: delegada, un escritor (disparador: 2+ archivos no
triviales y una migración). RED observado en `evaluar-par.spec.ts` (2 fallos antes
del motor). Backend 84 suites / 1725 pruebas verdes con `--runInBand`; lint,
prettier y frontend verdes. Revisión nativa: riesgo medio, `under_budget`, sin
revisión debida todavía (el rango se acumula hasta ~400 líneas).

T2 hecha en `e488934`. Ruta: delegada, un escritor (disparador: 2+ archivos no
triviales). RED observado: 6 pruebas fallidas antes de implementar. El nivel solo
se calcula para `origen = regla` (una propuesta del LLM guarda score 0.5 y se
vería como «media»; queda `null`). `CONFIANZAS` de sugerencias ahora apunta a
`NIVELES_CONFIANZA` (una sola lista). El orden de AC2 ya lo daba
`ORDER BY score DESC`; ahora tiene su prueba. Backend 85 suites / 1731 pruebas,
lint, prettier y frontend verdes (verificado por el padre). La pantalla del caso
aún no muestra el nivel; el contrato zod `contratos/caso.ts` ignora la clave nueva
(fuera de alcance, requiere mockup).

Revisión nativa de T1+T2 (rango desde el punto de ramificación, riesgo medio,
464 líneas, `slice_budget_reached`): consentimiento concedido por el usuario,
lente `review-reliability`, **aprobada** y acusada. Un hallazgo no bloqueante
(R3-001): el `down` de `MonedaNoSoportada` no tiene prueba directa; queda como
trabajo posterior, no reabre la revisión.

T3 hecha en `51cfc6f`. Ruta: inline (un archivo nuevo, patrón de la 4.3 ya
entendido). Excepción de RED: el repositorio ya cumplía, así que no hay RED
natural; se comprobó con mutación (violaciones inyectadas en `evaluar-par.ts` y
`sugerencias/candidatos.ts` hicieron fallar la prueba, luego revertidas) y con un
control de que el módulo `resolucion/`, donde la persona confirma, sí se detecta.
Backend 86 suites / 1748 pruebas, lint y prettier verdes. Siguiente: T4.
