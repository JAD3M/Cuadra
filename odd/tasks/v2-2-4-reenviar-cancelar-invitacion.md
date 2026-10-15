# v2 · Historia 2.4 — Reenviar o cancelar una invitación pendiente

Rama: `feat/v2-2-4-reenviar-cancelar-invitacion` (desde `master` tras la 2.3).
Cubre: FR-42, FR-50. Arquitectura: AD-14, AD-7.
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 2.4). Base: la 2.3
(`odd/tasks/v2-2-3-invitar-usuarios.md`).

## Objetivo

Un `admin` ve las invitaciones que nadie ha aceptado y puede reenviarlas
(enlace nuevo, el anterior deja de servir, la caducidad vuelve a contar) o
cancelarlas (el enlace deja de servir y sale de la lista). Ambas quedan en la
bitácora con quién y cuándo. Una invitación ya aceptada no cambia y el mensaje
es claro.

## Estado actual (exploración)

- `invitaciones` (`src/auth/invitacion.entity.ts`): viva = `consumida_en` y
  `reemplazada_en` nulos; índice único parcial `ux_invitaciones_viva`; sin
  `cancelada_en`. `cuadra_app` solo puede UPDATE de `consumida_en`,
  `reemplazada_en` y `updated_at`; SELECT e INSERT de tabla; sin DELETE.
- Patrón de reemplazo con SAVEPOINT y reintento por 23505 en
  `src/usuarios/invitar-usuarios.service.ts:51-98`; el correo sale con
  `ContextoEmpresa.alConfirmar` tras el commit.
- Estados del enlace en `src/invitaciones/invitaciones.service.ts:41-56`
  (`motivoInvalido`: usada, reemplazada, caducada) y sus textos.
- No existe listado de pendientes. `invitaciones` es clase 2 sin RLS: la
  empresa se impone con `WHERE company_id = $1` explícito.
- `ACCIONES_BITACORA` no tiene acciones para reenviar ni cancelar; una acción
  nueva exige `tipos.ts`, espejo, etiquetas, tonos, CHECK en migración y las
  pruebas de deriva.
- Matriz: `usuarios.ver` y `usuarios.gestionar` ya existen (solo `admin`).
- Frontend: `features/usuarios` solo tiene el formulario; el mockup de Usuarios
  no dibuja la lista de pendientes.

## Alcance

- Migración reversible: `invitaciones.cancelada_en` con GRANT UPDATE de
  columna, índice vivo y CHECKs ajustados; dos acciones nuevas de bitácora
  (`reenviar_invitacion`, `cancelar_invitacion`) en `ck_bitacora_accion`.
- `GET /usuarios/invitaciones` (pendientes de la empresa), `POST
  /usuarios/invitaciones/:id/reenviar` y `POST /usuarios/invitaciones/:id/cancelar`,
  con `@Permiso`, filtro de `company_id`, límite de peticiones, 409 con mensaje
  claro si ya fue aceptada o ya no está pendiente.
- La consulta del enlace devuelve el motivo `cancelada` con su texto.
- Espejo de acciones de bitácora en el frontend.
- Mockup (lista de pendientes en Usuarios y estado «cancelada» en la
  invitación) acordado antes de la interfaz; después la interfaz.

## Fuera de alcance

- Lista de usuarios de la empresa (2.5), cambiar o quitar roles (2.6).
- Notificar al invitado de una cancelación.

## Decisiones tomadas

- **Cancelar** usa una columna propia `cancelada_en`, no `reemplazada_en`:
  quien abra el enlace debe leer «fue cancelada», no «fue reemplazada».
- **Acciones de bitácora nuevas** en lugar de reutilizar `invitar`: «Invitación
  enviada» leería mal una cancelación y el filtro por acción dejaría de servir.
- **«Pendiente»** = no consumida, no reemplazada y no cancelada. Las vencidas
  siguen pendientes (muestran «vencida») y se pueden reenviar o cancelar: es el
  caso de la invitación perdida.
- **Reenviar** reemplaza la fila (nueva fila, la anterior marcada
  `reemplazada_en`), igual que invitar de nuevo; conserva correo y roles y
  registra como invitador a quien reenvía.
- Las invitaciones creadas por la plataforma para el primer admin entran en la
  lista de pendientes de su empresa.
- Los endpoints devuelven 409 (no 404) con mensaje cuando la invitación existe
  en la empresa pero ya no está pendiente; una invitación de otra empresa es 404.

## Delivery

Estrategia de cadena `stacked-to-main`, una rebanada por unidad de trabajo.

## Tareas

- [x] **T1** Migración (`cancelada_en`, GRANT, índice, CHECK de acciones), tipos, motivo `cancelada` en la consulta del enlace y espejo de acciones en el frontend. Ruta: delegada (un escritor). Commit: `62aad81`.
- [x] **T2** Endpoints de listar, reenviar y cancelar: permisos, límite, bitácora con quién y cuándo, 409 claro, aislamiento por empresa; pruebas. Ruta: delegada (un escritor). Commit: ver `git log` (`feat(usuarios): listar, reenviar y cancelar invitaciones pendientes`).
- [x] **T3** Mockup: lista de pendientes en Usuarios y estado «cancelada» de la invitación, oscuro y claro, acordado con el usuario (aprobado por el usuario el 2026-10-15).
- [x] **T4** Interfaz: lista de pendientes con reenviar y cancelar, y mensaje de enlace cancelado, sobre el mockup aprobado. Ruta: delegada (un escritor). Commits: `a17cf24` (estado cancelada en la invitación) y `247fe7a` (lista de pendientes, reenviar y cancelar).
- [x] **T5** Cierre: pruebas completas, bitácora, PRs en cadena. Ruta: inline. Seis rebanadas `stacked-to-main`; `CUADRA.md` no cambia (sigue el estado de la v1).

## Criterios de aceptación

Los de la historia en `epics.md`: reenviar da enlace nuevo y el anterior deja
de servir con caducidad renovada; cancelar deja el enlace sin servir y la quita
de pendientes; aceptada → mensaje claro sin cambios; ambas en la bitácora con
quién y cuándo; solo `admin`.

## Verificación

- Backend: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
  prettier sobre `src` y `scripts`.
- Frontend: `cd frontend && npm test`, `npm run lint`, `npm run format:check`,
  `npm run typecheck`.
- `docs/bitacora.md` no se pasa por prettier.

## Progreso

T1 a T4 hechas. Siguiente paso: T5 (cierre: pruebas completas, bitácora, PRs en cadena).

## Evidencia

- T1 RED: `npm test -- src/database/esquema.spec.ts src/invitaciones -t "historia 2.4"`
  → 5 fallos: `column "cancelada_en" of relation "invitaciones" does not exist`
  (x4) y `violates check constraint "ck_bitacora_accion"`.
- T1 GREEN: `npm test` 59 suites / 1232 tests pasan (incluye la reversibilidad
  de `plataforma.esquema.spec.ts` y `esquema.spec.ts` con la migración nueva);
  `npm run typecheck`, `lint`, `build` y prettier de `src`/`scripts` limpios.
  Frontend: `npm test` 266 archivos / 4229 tests, lint, format:check y
  typecheck limpios.
- Nota: `src/plataforma/invitaciones-plataforma.service.ts` (invitar desde
  plataforma) aún no excluye las canceladas en su UPDATE de reemplazo; queda
  fuera del alcance de escritura de T1/T2. El efecto es que una cancelada del
  correo pasa a leerse como «reemplazada», lo cual es cierto.
- T2 RED: `npm test -- src/usuarios` → 22 fallos de 39, todos por ruta
  inexistente (`expected 200 "OK", got 404 "Not Found"`, 403/401/429/409/503
  igual con 404).
- T2 GREEN: `npm test` 59 suites / 1256 tests; typecheck, lint, build y
  prettier limpios; frontend sin cambios (266 archivos / 4229 tests).
- Decisiones de T2: cancelar responde `200 {email}`; reenviar `201 {email,
  roles}` como invitar; la bitácora usa `entidad` `companies` y `entidad_id` la
  empresa (como invitar) con `datos` `{invitacionId, email, roles}`; en
  reenviar `invitacionId` es la fila nueva y se agrega `anteriorId`; el listado
  va de la más reciente a la más antigua.
- T3: mockup aprobado por el usuario el 2026-10-15.
- T4 RED: `npx vitest run` sobre los contratos, la pantalla de invitación y
  Usuarios → 18 fallos en contratos (`invitacionPendiente`, `invitacionesPendientes`,
  `invitacionReenviada`, `invitacionCancelada` indefinidos) y `cancelada`
  (`ZodError` en el enum de motivos, `Unable to find role="heading"`); luego 33
  fallos en `InvitacionesPendientes.test.tsx` y el flujo de la app por
  `Unable to find role="region" and name "Invitaciones pendientes"`.
  `vencimiento.test.ts` se escribió junto con su módulo (sin RED separado).
- T4 GREEN: `npm test` 268 archivos / 4286 tests; `npm run lint`,
  `format:check` y `typecheck` limpios.
- Decisiones de T4: los avisos de fila se guardan por correo (reenviar crea
  fila con id nuevo); 409 muestra el mensaje del servidor (el cuerpo no trae
  código estable) y no vuelve a pedir la lista; 404 usa «Esta invitación ya no
  está pendiente.»; «Vence en N días» usa el reloj solo para el texto (mínimo 1
  día) y `vencida` la decide el servidor; la fecha de envío es el día del ISO en
  UTC como en la bandeja; la lista se ve con `usuarios.ver` y las acciones y el
  formulario piden `usuarios.gestionar`; el foco va a «Volver» al abrir la
  confirmación; la vencida usa `--color-danger-tint` porque
  `--color-danger-chip` está aislado a la bitácora.
