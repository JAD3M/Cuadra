# Historia 3.6: El dueño levanta la vista previa obligatoria de un banco

Rama: `feat/v2-3-6-levantar-vista-previa`
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 3.6)

## Objetivo

Que el dueño pueda exigir la vista previa en todas las cargas de un banco hasta
tener evidencia de que su lector es confiable, y levantarla cuando la hay.

## Problema

Hoy la vista previa de un PDF es incondicional
(`cargas.service.ts`, estado `pendiente_vista_previa`). No existe catálogo de
bancos ni tabla `bancos_vista_previa`. El dueño no tiene forma de levantarla.

## Decisiones

- 2026-11-03, con el usuario: una carga cuenta como **revisada** solo si fue
  **aceptada**. Las rechazadas no cuentan. Motivo: la evidencia de confiabilidad
  es el acierto del lector, no el hecho de que alguien lo mirara.
- 2026-11-03, propuesta del agente (se revisa si hay objeción): el conteo
  entre empresas se hace con una función SQL `SECURITY DEFINER` que solo
  devuelve la agregación por banco. No se usa BYPASSRLS ni se recorre empresa
  por empresa.
- 2026-11-03, **corregida**: `bancos_vista_previa` es clase 3 (AD-2,
  `ARCHITECTURE-SPINE.md:50,262`): sin `company_id`, sin RLS, y solo
  `plataforma/` la nombra. Se queda en `arquitectura.ts`. `cargas.service` no
  la nombra: pregunta a un servicio de `plataforma/`
  (`estaLevantado(banco)`). El usuario pidió respetar la arquitectura.
- 2026-11-03: el usuario **aprobó** las dos propuestas anteriores. La función
  fija `search_path`, revoca `EXECUTE` a `PUBLIC`, lo da solo a `cuadra_app`,
  sin SQL dinámico, y su dueño no debe ser superusuario (verificar en T1).
- El mínimo es 5 cargas aceptadas. Sin regla extra de tasa de aciertos (no está
  en los criterios).

## Alcance autorizado

- Migración nueva (`1790710500000-…`): tabla, acción de bitácora, función de
  conteo.
- Endpoints del dueño en `src/plataforma/`.
- Bifurcación en `src/cargas/` para bancos levantados.
- Pantalla del dueño: solo después de acordar el mockup.
- No se adelantan otras historias.

## Reglas no negociables que aplican

- Tabla de dominio nueva: GRANTs explícitos para `cuadra_app` en la misma migración.
- Un falso positivo es peor que no conciliar; el cuadre de saldos sigue aplicando.
- Estados y acciones salen de `src/common/entities/tipos.ts`.

## Tareas

- [x] T1 (delegada a un escritor; sin RED real, Postgres estaba caído al escribir
  el spec; suite completa 74/74 suites y 1566 tests, prettier/eslint/tsc limpios)
  Migración: `bancos_vista_previa` (banco, quién, cuándo), acción
  `levantar_vista_previa` en el CHECK de `bitacora_plataforma`, función de
  conteo de aceptadas por banco. Actualizar `tipos.ts` y los conteos de
  `undoLastMigration` en los specs de esquema.
- [x] T2 (delegada; RED real 9 de 10 fallan, GREEN 10/10; suite completa 75
  suites y 1576 tests; 422 si hay menos de 5, 409 si ya está levantado)
  Backend del dueño: consultar banco (aceptadas por consulta, si está
  levantado) y levantar (rechaza con mensaje claro si hay menos de 5; 403 a
  sesión de empresa; escribe `bancos_vista_previa` y `bitacora_plataforma`).
- [ ] T3 Cargas: si el banco está levantado, el PDF que cuadra pasa directo a
  conciliación; si no, sigue la vista previa. El cuadre de saldos se mantiene.
- [ ] T4 Frontend del dueño: mockup acordado primero, luego pantalla del banco
  con su conteo y el botón de levantar.
- [ ] T5 Docs: `docs/bitacora.md` y `CUADRA.md`.

## Aceptación

Los seis criterios de la historia en `epics.md`, más tests por cada uno.

## Rutas y evidencia

Pendiente. Se registra por tarea (inline o delegada, commit).

## Progreso

- 2026-11-03: exploración hecha, documento creado, ninguna tarea iniciada.
