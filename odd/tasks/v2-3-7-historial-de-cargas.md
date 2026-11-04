# Historia 3.7: Ver el historial de cargas de mi empresa

Rama: `feat/v2-3-7-historial-de-cargas`
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 3.7, líneas 988-1017)

## Objetivo

Que admin y contador vean sus cargas con su estado y puedan abrir una carga
rechazada para ver el motivo del rechazo.

## Problema

`GET /cargas` y `FilaCarga` ya cubren la lista (AC1), el enlace a la vista
previa (AC3) y el aislamiento por empresa en el listado (AC4). Falta AC2: las
filas no son clicables y descartar una vista previa
(`vista-previa.service.ts`, estado `rechazada`) no guarda el motivo.

## Decisiones

- 2026-11-03, con el usuario: AC2 se resuelve solo con el **descarte de la vista
  previa** (opción A). Un PDF que no cuadra sigue sin crear carga (AD-8) y su
  rechazo se ve al subir (UX-DR8) y como entrada `rechazar` en la bitácora.
- 2026-11-03, **reemplazada**: el texto de las líneas no leídas ya NO se guarda.
  Verificado en `cargas.service.ts:288`: un PDF con una sola línea no leída se
  rechaza con 400 antes de crear la carga (AD-8), así que una carga en
  `pendiente_vista_previa` nunca trae líneas no leídas. El usuario eligió
  guardar solo el **motivo** del descarte.
- 2026-11-03, con el usuario: el motivo es un **campo opcional** al descartar la
  vista previa (`POST /cargas/:id/rechazar` acepta `motivo`); si viene vacío se
  guarda un mensaje fijo del backend. Consecuencia (UX-DR1): la pantalla de la
  vista previa gana un campo, así que el mockup se actualiza y se acuerda antes
  de escribir esa parte del frontend (T3).
- 2026-11-03, con el usuario: mockups actualizados y **aprobados** (canvas
  «Cuadra — mockups del frontend», tableros 4 · Cargas y 18 · Vista previa del
  PDF). La carga rechazada se abre como **fila expandible** en la tabla (sin
  pantalla ni ruta nuevas); la Vista previa gana el campo «Motivo (opcional)» en
  la confirmación de rechazo. Como `GET /cargas` no trae el motivo, el frontend lo
  pide a `GET /cargas/:id` al expandir.
- Pendiente como historia aparte, solo si el contador lo necesita en el historial:
  crear la carga `rechazada` por cuadre o líneas ilegibles, con motivo y líneas.
  Exige enmendar AD-8 en el spine.
- 2026-11-03, verificado: las etiquetas en español de los estados se quedan en
  el frontend. UX-DR4 y AD-12 piden que las listas de valores salgan de
  `tipos.ts`, no las etiquetas (mismo criterio que la 2.7).

## Alcance autorizado

- Migración nueva para guardar el motivo del descarte en `cargas`.
- `src/cargas/` y `src/common/entities/` (detalle, descarte, DTO).
- Frontend `frontend/src/features/cargas` y espejo en `frontend/src/shared/dominio`.
- Pantalla de detalle: solo después de leer el mockup de Cargas (UX-DR1); si
  falta algo en el mockup, primero se actualiza y se acuerda.
- No se adelantan otras historias. No se toca el spine.

## Reglas no negociables que aplican

- Toda consulta con filtro `company_id`; carga ajena responde 404.
- Columnas en `snake_case`; montos en `NUMERIC`.
- Estados y acciones salen de `src/common/entities/tipos.ts`.
- Permiso `cargas.ver` (admin y contador); el frontend no decide roles.

## Tareas

- [x] T1 Backend: migración con `motivo_rechazo` en `cargas`; `POST
  /cargas/:id/rechazar` acepta `motivo` opcional (validado, longitud máxima) y,
  si falta o viene vacío, guarda un mensaje fijo; el descarte lo persiste. Con RED primero. (Primer intento bloqueado el
  2026-11-03: las líneas no leídas no existen en una vista previa; ver Decisiones.)
  Evidencia 2026-11-03: RED (5 fallos: columna `motivo_rechazo` inexistente y 200 en vez de 400),
  GREEN con `npm test` 79 suites / 1616 pruebas, tsc, eslint y prettier limpios. Migración
  `1790710600000-MotivoRechazoCarga`. Ruta: delegada (escritor único). Commit: c437a3e.
- [x] T2 Backend: `GET /cargas/:id` expone el motivo de una carga `rechazada`; pruebas de 404 para carga de otra empresa y 403 sin permiso.
  Evidencia 2026-11-03: RED (3 fallos: falta `motivoRechazo` en la respuesta), GREEN con `npm test`
  79 suites / 1621 pruebas, tsc, eslint y prettier limpios. `motivo_rechazo` entra a `SQL_ESTADO`
  (también lo ven las respuestas del POST); se actualizó el `toEqual` de `cargas.integracion.spec.ts`.
  Ruta: delegada (escritor único). Commit: 87fb471.
- [x] T3 Frontend: mockup primero (Cargas y el campo opcional en la Vista previa), acordado con el usuario; luego fila clicable y detalle de la carga
  rechazada (motivo); espejo de tipos si cambian.
  Evidencia 2026-11-03: RED (29 fallos en 6 archivos: campo ausente, contrato sin `motivoRechazo`, fila sin botón, CSS sin clases),
  GREEN con `npm test` 291 archivos / 4718 pruebas, typecheck, eslint y prettier limpios. Vista previa: campo «Motivo (opcional)»
  (`ConfirmarRechazo`), el cuerpo `{motivo}` solo si el texto recortado no está vacío. Cargas: fila `rechazada` expandible
  (botón de 44 px + clic en la fila, una abierta a la vez), `GET /cargas/:id` al abrir (`useDetalleCarga`, misma clave que el sondeo).
  Sin verificación visual en navegador. Ruta: delegada (escritor único). Commit: 7ba0f23.
- [x] T4 Docs: `docs/bitacora.md` y `CUADRA.md`.
  Evidencia 2026-11-03: entrada 3.7 en la bitácora y sección «Motivo del descarte (v2, historia 3.7)» en `CUADRA.md`.
  Dos pruebas de caracterización en `vista-previa.integracion.spec.ts` (motivo numérico: 400; motivo de 500 caracteres: 200 y guardado):
  pasaron a la primera, sin RED, porque el DTO ya lo implementa. Suite: 54 pruebas pasan. Ruta: delegada (escritor único).

## Aceptación

Los cinco criterios de la historia en `epics.md`, con una prueba por cada uno.

## Rutas y evidencia

Pendiente. Se registra por tarea (inline o delegada, commit).

## Progreso

- 2026-11-03: exploración hecha, documento creado, rama creada, ninguna tarea
  iniciada.
- 2026-11-03: T1-T3 commiteadas (c437a3e, 87fb471, 7ba0f23). Revisión nativa de
  T1+T2 y de T3 aprobadas, sin hallazgos bloqueantes. T4 hecha. PR pendiente
  (lo abre el padre).
