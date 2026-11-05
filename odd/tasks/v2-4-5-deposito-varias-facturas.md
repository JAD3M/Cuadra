# Historia 4.5: Proponer un depósito que cubre varias facturas

Rama: `feat/v2-4-5-deposito-varias-facturas`
Jira: KAN-141 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 4.5)
Spine: AD-4 (también AD-3 y AD-19)
Mirror Engram: `odd/v2-4-5-deposito-varias-facturas/tasks`

## Objetivo

Que Cuadra proponga un depósito que paga varias facturas a la vez, para no sumar
facturas a mano. Una sola propuesta con una línea por factura y la diferencia del
grupo; nunca se cierra sola.

## Problema

El esquema ya admite n líneas (`decision_lineas`, `decisiones.diferencia_monto`,
`huella_conjunto(uuid[])`) y `ResolucionService.confirmar` ya es atómico para n
facturas. Falta el motor: hoy solo evalúa pares. Mapeo del 2026-11-04:

| AC | Estado |
| --- | --- |
| 1 subconjunto único → una propuesta con n líneas y diferencia del grupo | falta (motor y servicio) |
| 2 varias combinaciones → nada, el caso explica la ambigüedad | falta (motivo nuevo + migración) |
| 3 suma fuera de tolerancia → nada | falta |
| 4 confirmar todo o nada en una sentencia | hecho; faltan pruebas con n facturas y bitácora con todos los CFDI |
| 5 nunca en lote ni se cierra sola | parcial; falta la prueba que lo fije |
| 6 factura ya confirmada no entra | índice hecho en BD; falta en el motor (se reutiliza `cfdisOcupados`) |

## Decisiones

- 2026-11-04: **«misma contraparte» = mismo `cfdi.rfc_receptor`.** La v1 no agrupa
  por RFC (solo proponía pares), así que el supuesto del epic no tiene respaldo
  allá; se adopta por ser más conservador (menos falsos positivos). El motor solo
  trae facturas emitidas por la empresa, y los movimientos no tienen RFC: el
  depósito se evalúa contra cada grupo de RFC por separado.
- 2026-11-04: **cota de búsqueda** (el spine no fija ninguna y la búsqueda es
  exponencial): subconjuntos de 2 a 5 facturas, y como máximo 20 candidatos por
  RFC. Si un RFC excede los 20, no se propone nada y el caso lo explica con un
  motivo propio. Son constantes con nombre, fáciles de cambiar.
- 2026-11-04: **precedencia:** las reglas de una sola factura (1-3) van primero; la
  búsqueda de grupos solo corre si no produjeron propuesta ni ambigüedad.
- 2026-11-04: **facturas ya propuestas:** se excluyen igual que en las reglas de una
  factura (`cfdisOcupados`: en otra propuesta o confirmada), por consistencia y
  por preferir no conciliar. AD-4 permite una factura en varias propuestas a
  nivel de BD; el motor es más estricto a propósito.
- Determinismo: los candidatos se ordenan por id antes de combinar; el orden de
  entrada no cambia el resultado.
- «Exactamente un subconjunto»: ambiguo si hay dos o más subconjuntos (del mismo
  RFC o de RFC distintos) dentro de la tolerancia; entonces no se propone.

## Alcance autorizado

- Backend: `src/conciliacion/evaluar-par.ts` (y un archivo nuevo de grupos si es
  más claro), `conciliacion.service.ts`, `src/common/entities/tipos.ts`, una
  migración nueva (CHECKs de regla/`regla_sin_match` si aplican), `src/resolucion/**`,
  `src/casos/**`, `src/bandeja/**`, `src/sugerencias/**` solo donde asuman una
  única factura por propuesta, y sus specs.
- Frontend: solo espejar valores de `tipos.ts` y tipos/contratos aditivos; sin
  cambiar pantallas (el mockup manda).
- Fuera: mostrar propuestas de grupo en la pantalla del caso (requiere mockup),
  lotes reales, facturas canceladas (4.6).

## Reglas no negociables que aplican

- Toda query del dominio con `company_id`; montos `NUMERIC`/`Dinero`, nunca flotante.
- El motor decide; la IA solo sugiere y nunca cierra un caso (AD-3).
- Un falso positivo es peor que no conciliar.
- Estados, reglas y motivos salen de `tipos.ts`; el frontend no inventa valores.
- Migraciones: `up` y `down`; nada de tablas nuevas en esta historia.

## Tareas

- [x] **T1** Motor puro: `rfcReceptor` en `CfdiAbierto`, búsqueda determinista de
  subconjuntos por RFC con las cotas, regla de grupo y motivos nuevos
  (`combinaciones_multiples`, candidatos excedidos), migración de CHECKs, specs
  unitarios (único, ambiguo, fuera de tolerancia, RFC distintos, cotas,
  determinismo, precedencia).
- [x] **T2** Servicio: cargar `rfc_receptor`, filtrar rechazados por `huella_conjunto`,
  persistir propuestas de n líneas con la diferencia del grupo, `requiere_revision`
  y `lote_id` fijos, integración con base real (incl. factura confirmada que no
  entra y rechazo por huella).
- [ ] **T3** Resolución y lectura: confirmar/rechazar con n facturas (prueba de
  atomicidad con rollback), bitácora y respuesta con todos los CFDI, casos/bandeja/
  sugerencias que asuman una factura por propuesta, prueba de que nunca va a lote.
- [ ] **T4** Cierre: bitácora, `CUADRA.md`, Jira KAN-141, PR (en cadena si pasa de
  400 líneas) y repaso.

## Rutas

Se declara por tarea al ejecutarla (inline o delegada, con su disparador).

## Verificación

Backend: `npm test` (siempre `--runInBand`, Postgres en 5432), `npm run lint`,
`npx prettier --check src scripts`; frontend: `typecheck`, `lint`, `format:check`,
`vitest run`.

## Progreso

T1 hecha en `7147d6c`. Ruta: delegada, un escritor (disparador: 2+ archivos no
triviales y una migración). RED observado: `evaluar-grupo.spec.ts` no encontraba el
módulo. Nuevo: `evaluar-grupo.ts` (puro, determinista, cotas 2-5 facturas y 20
candidatos por RFC), `REGLA_SUMA_GRUPO` con puntuación 0.6 (nivel `media`, después
de la regla 1 y antes de la 2), motivos `combinaciones_multiples` y
`candidatos_excedidos`, migración `1790713000000`. Backend 88 suites / 1769 pruebas,
lint, prettier y frontend verdes.

Correcciones del padre sobre lo que devolvió el escritor: el `down` de
`1790712000000-MonedaNoSoportada` derivaba su lista de la constante viva y dejaba en
el CHECK los dos valores nuevos; ahora usa una lista congelada (también el `up`).
La sugerencia R3-001 de la 4.4 (probar el `down` directamente) queda cubierta por
`combinaciones-multiples.migracion.spec.ts`.

Desvío aceptado: `CfdiAbierto.rfcReceptor` es opcional (hacerlo obligatorio tocaba
archivos de sugerencias y demo fuera de la superficie). Un valor ausente o vacío
nunca forma grupo. Riesgo anotado para T2: si un RFC excede los 20 candidatos, no se
propone nada aunque otro RFC tenga un subconjunto limpio (decisión conservadora:
no ocultar una ambigüedad); puede verse como ruido por movimiento.

Revisión nativa de T1 (riesgo medio, 828 líneas, `slice_budget_reached`):
consentimiento concedido, lente `review-reliability`, **aprobada** sin hallazgos y
acusada.

La revisión de toda la rama (lente `review-reliability`) dejó un WARNING válido:
la migración `1790713000000` derivaba sus listas de la constante viva, igual que
`1790712000000`. El padre congeló las listas en las dos (`c01a1cb`); el escritor
había afirmado que ya estaban congeladas y no era cierto.

T2 hecha en `6e708ae`. Ruta: delegada, un escritor (disparador: 2+ archivos no
triviales, SQL y demo). RED observado: 6 pruebas de integración fallidas antes de
implementar. `proponerGrupos` (puro) + `insertarGrupos` (una sentencia CTE con la
decisión, una línea por factura y la bitácora). El grupo solo se busca cuando el
resultado de una factura fue `sin_candidato_monto`; los conjuntos rechazados no se
re-proponen pero siguen contando para la ambigüedad; dos depósitos que compiten por
una factura no proponen ninguno (el orden de entrada nunca decide).
Efecto en el demo: un movimiento de Ferretería S7 (6496.04) sumaba tres facturas
del mismo receptor; el generador de montos del demo ahora evita montos cercanos a
sumas de 2 a 5 facturas, el espejo del motor reutiliza `proponerGrupos`, y se
regeneraron los dos CSV de `demo/` (exigido por `demo-drift.spec.ts`). Backend 88
suites / 1786 pruebas, lint y prettier verdes (verificado por el padre).
Revisión nativa de T2 (riesgo medio, 667 líneas): aprobada sin hallazgos y acusada.

Para T3: la propuesta de grupo es una fila de `decisiones` con
`regla = 'suma_grupo'` y varias `decision_lineas`; la bitácora `crear` de un grupo
guarda `datos.cfdiIds` (arreglo, sin `cfdiId`), así que los lectores deben tolerar
ambas formas; las facturas de la ambigüedad (`combinaciones_multiples`) solo existen
como etiquetas en `motivo_sin_match`, no como ids. Riesgos anotados: rendimiento de
la búsqueda (~21 mil subconjuntos por RFC y por movimiento, sin poda); un grupo
omitido por rechazo o competencia deja `sin_candidato_monto` (mensaje algo engañoso).

Siguiente: T3.
