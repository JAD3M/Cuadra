# Historia 4.6: Sacar de las propuestas las facturas canceladas

Rama: `feat/v2-4-6-facturas-canceladas`
Jira: KAN-142 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 4.6)
Spine: AD-4, AD-7 (también AD-19)
PRD: FR-66 y sección 6 «No objetivos»
Mirror Engram: `odd/v2-4-6-facturas-canceladas/tasks`

## Objetivo

Que una factura cancelada deje de proponerse, para no conciliar un pago contra un
CFDI que ya no vale. Cuadra no consulta al SAT y nunca reabre sola una decisión
confirmada.

## Problema

Mapeo del 2026-11-05:

| AC | Estado |
| --- | --- |
| 1 CFDI cancelado al cargar o actualizar → `cancelada` y sus propuestas vivas → `obsoleta` | falta: el lector nunca emite `cancelada` y reexportar da `ya_existia` sin actualizar nada |
| 2 el motor no considera una `cancelada` | casi hecho: motor, sugerencias y resolución ya filtran `estado = 'abierta'`; faltan pruebas explícitas |
| 3 `cancelada` ya en una decisión `confirmada` → `requiere_revision`, visible en la bandeja, nunca se reabre sola | falta: la columna existe pero nada la escribe y bandeja y casos no la exponen |
| 4 sin consulta al SAT; acción en bitácora | falta la bitácora |
| 5 la prueba de deriva sigue en verde | `cancelada` ya está en `ESTADOS_CFDI`, la entidad y la migración |

## Decisiones

- **Señal de cancelación:** atributo `Estatus="Cancelado"` en el nodo `Comprobante`
  del XML cargado. Es una **convención de Cuadra, no del SAT**: un CFDI 4.0 real no
  trae marca de cancelación (vive en el SAT). Aprobada por el usuario el 2026-11-05.
- **Sin consulta al SAT** (PRD §6, FR-66). Límite conocido, ver Pendientes.
- **Bitácora:** acción existente `actualizar` sobre la entidad `cfdi`; el id del CFDI
  va en `entidad_id` y los detalles en `datos`. No hay acción nueva, así que no hay
  migración de CHECK. Si la prueba de deriva o `ENTIDADES_BITACORA` exigen otra cosa,
  se ajusta y se anota.
- **Estados que cancelan:** un CFDI en `abierta`, `parcialidades` o `conciliada` pasa
  a `cancelada`. Uno ya `cancelada` no cambia (idempotente).
- **Reexportar:** si el archivo ya existe (`ya_existia`) y su XML indica cancelación,
  se aplica la transición de cancelación sobre el CFDI existente.
- **Candado:** AD-19. Candado de empresa, decisiones por `id` ascendente, luego CFDI.

## Alcance autorizado

Backend de la historia: lector y guardado de CFDI, la transición de cancelación,
exponer `requiereRevision` en bandeja y casos, pruebas y documentación. El frontend
(mostrar «requiere revisión» en bandeja y caso) **queda condicionado a actualizar y
acordar el mockup primero** (regla del `CLAUDE.md`).

## Reglas no negociables que aplican

`company_id` en toda query; montos `NUMERIC`; el motor decide y nunca cierra;
un falso positivo es peor que no conciliar; la transición es una sola sentencia
atómica con su bitácora (AD-7), con `rowCount` verificado y `23505` → 409.

## Tareas

- [x] **T1 Lector y guardado.** `leerCfdi` reconoce `Estatus="Cancelado"`; un CFDI
  nuevo cancelado entra como `cancelada`. Pruebas con RED.
- [x] **T2 Transición de cancelación.** Una sentencia atómica: CFDI → `cancelada`,
  propuestas vivas de ese CFDI → `obsoleta`, decisiones `confirmada` →
  `requiere_revision = true` (sin reabrir ni tocar `movimientos.estado`), bitácora
  `actualizar`/`cfdi`. Idempotente. Pruebas de integración.
- [x] **T3 Reexportar.** `ya_existia` con XML cancelado dispara T2 sobre el CFDI
  existente; sin cancelación no cambia nada.
- [x] **T4 Motor y sugerencias.** Pruebas explícitas: una `cancelada` no se propone
  ni sugiere, ni en pares ni en grupos.
- [x] **T5 Bandeja y casos.** Exponer `requiereRevision` en la API y contratos.
- [ ] **T6 Cierre.** Hecho: `CUADRA.md` (pendientes y el límite del SAT) y bitácora.
  Pendiente: repaso en Engram y PR (en cadena si pasa de 400 líneas).
- [ ] **T7 Frontend (condicionada).** Solo tras actualizar y acordar el mockup.

## Rutas

Se registra por tarea la ruta (en línea o delegada) y la evidencia del disparador.

- T1 a T5: delegadas a un solo escritor. Disparador: 2 o más archivos no triviales y lectura de preparación.
- T6 (documentación): delegada a un escritor de documentos, mismo disparador.

## Verificación

`npm test -- <ruta>` por tarea (usa `--runInBand`); al cierre backend completo,
`format:check` y `npm run demo:generar` si cambian fixtures (`demo-drift.spec.ts`).
Los escritores pegan la salida RED.

## Pendientes y límites conocidos

- **Consulta al SAT:** un XML de CFDI 4.0 real no marca la cancelación. Detectar las
  cancelaciones reales en producción exigiría consultar el servicio de estatus del
  SAT (RFC emisor, RFC receptor, total y UUID; devuelve Vigente, Cancelado o No
  Encontrado, y puede haber cancelación «en proceso»). Hoy es un no objetivo del PRD
  (§6). Sería una historia aparte, con enmienda del PRD, FR-66 y el spine, y con
  decisión sobre qué estado queda si el SAT no responde.
- (b) El frontend no muestra `requiereRevision` en bandeja ni en el caso: antes hay
  que actualizar el mockup y acordarlo (T7).
- (c) Resumen de la bandeja: la `confirmada` marcada cuenta como `conciliado` y no
  entra en «por revisar»; cambiarlo exige mockup.
- (d) Si `cancelarCfdi` falla al resubir un archivo (409 o error de SQL), la
  excepción aborta todo el lote en vez de reportar solo ese archivo
  (`src/cargas/guardar-cfdi.ts:89-91`); esa ruta no tiene prueba (hallazgo no
  bloqueante de la revisión).
- (e) `cfdi` no está en `ENTIDADES_BITACORA` (la prueba ENT-1 fija la lista y el
  frontend la espeja); `GET /bitacora` acepta cualquier entidad, así que las
  entradas se ven; decidir al tocar el frontend.
- (f) La `confirmada` marcada no tiene orden prioritario en la bandeja.

## Progreso

- 2026-11-05: mapeo hecho, documento creado, KAN-142 en curso, rama creada.
- 2026-11-05: T1 hecha (ruta delegada, escritor único). `leerCfdi` expone `cancelado` y `estadoInicial = 'cancelada'` con `Estatus="Cancelado"`; el guardado ya lo inserta tal cual. RED: 4 pruebas fallando; GREEN: 81/81 en lector y cargas. Commit: 097edc4.
- 2026-11-05: T2 hecha. `src/cfdi/cancelar-cfdi.ts`: candado de empresa, decisiones por id, CFDI, y una sentencia CTE (cfdi, obsoletas, por_revisar, bitácora `actualizar`/`cfdi`) con `rowCount` verificado y 23505 -> 409. RED: módulo inexistente; GREEN: 10/10. Commit: ae915d8. No se agregó `cfdi` a `ENTIDADES_BITACORA` (la prueba ENT-1 y el espejo del frontend fijan la lista): pendiente de decisión.
- 2026-11-05: T3 hecha. `guardarCfdi`: en `ya_existia`, si el XML trae la señal, aplica `cancelarCfdi` al existente (usuario = quien subió la carga) y agrega `cancelada: true` al resultado (`ResultadoDeArchivoCfdi`, local a guardar-cfdi.ts; `carga.entity.ts` y el espejo del frontend no se tocaron: el zod del frontend descarta claves desconocidas). RED: 3 de 4 pruebas nuevas fallando; GREEN: cargas y cfdi 210/210. Commit: 07271c8.
- 2026-11-05: T4 hecha. Pruebas de caracterización (el motor ya filtraba `abierta`, no hay RED posible): par y grupo en `conciliacion.integracion.spec.ts`, candidatos, un solo candidato y carrera de cancelación en `sugerencias.integracion.spec.ts`. GREEN: 8 nuevas; suite completa 90 suites / 1828 pruebas en verde. Commit: ca242c4.
- 2026-11-05: T5 hecha (ruta en línea, 2 archivos de servicio con cambio mecánico + pruebas). `requiereRevision` en bandeja (fila) y casos (caso y propuesta); una confirmada con la marca entra en la lista por defecto sin cambiar orden. RED: 4 pruebas fallando; GREEN: bandeja y casos 95/95. Commit: c27d660.
- 2026-11-05: revisión nativa de los commits T1 a T4: aprobada, una lente, un hallazgo no bloqueante (pendiente d).
- 2026-11-05: T6 parcial: `CUADRA.md` y bitácora escritas (suite final backend 90 suites, 1834 pruebas; un fallo intermitente en `esquema.spec.ts` «usa el índice parcial» que pasa solo). Faltan el repaso en Engram y el PR. T7 sigue condicionada al mockup.
