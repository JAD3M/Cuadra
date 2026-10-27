# v2 · Historia 2.6 — Cambiar o quitar los roles de un usuario

Ramas en cadena (una por tarea, cada una sobre la anterior):
`feat/v2-2-6-01-api-roles` → `feat/v2-2-6-02-frontend-contrato-hook` →
`feat/v2-2-6-03-frontend-pantalla`.
Cubre: FR-45, FR-46. Arquitectura: AD-2, AD-11.
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 2.6). Base: la 2.5
(`odd/tasks/v2-2-5-lista-usuarios.md`) y la 2.4 como plantilla de acción.

## Objetivo

Un `admin` cambia los roles de alguien de su equipo o le quita el acceso a su
empresa. El cambio aplica en la siguiente petición de esa persona y queda en la
bitácora como `cambiar_rol` o `quitar_rol`. Si se queda sin roles, pierde la
empresa de inmediato (y sus sesiones elegidas en ella dejan de servir) pero
conserva lo que tenga en otras empresas. El único `admin` no se puede quitar ni
degradar.

## Estado actual (exploración, 2026-10-27)

- `user_company_roles`: una fila por (usuario, empresa, rol), sin RLS. `cuadra_app`
  tiene SELECT de tabla e `INSERT (user_id, company_id, rol)`; **no tiene
  DELETE**.
- Roles leídos en cada petición (`AuthService.rolesEnEmpresa`); sin roles el
  `RolesGuard` responde 403 «Sin acceso a esta empresa».
- `sesiones` tiene `user_id` y `company_id`; `SesionesService` solo sabe
  `cerrar(token)`. `cuadra_app` ya tiene DELETE sobre `sesiones`.
- Bitácora: sin servicio de escritura, cada servicio hace `INSERT` directo
  (patrón de `invitaciones-pendientes.service.ts`, método `registrar`). El CHECK
  `ck_bitacora_accion` sale de `ACCIONES_BITACORA` (`src/common/entities/tipos.ts`).
- Frontend: la tabla `ListaUsuarios.tsx` solo da acciones en filas pendientes;
  espejo de acciones de bitácora en `shared/dominio/{tipos,etiquetas}.ts` y
  `features/bitacora/tonos.ts`.
- Mockup de Usuarios con editar roles y quitar acceso: aprobado el 2026-10-27
  (canvas versión 79, tema oscuro y claro).

## Alcance

- `PATCH /usuarios/:id/roles` con el conjunto final de roles (1 a 4). Con
  conjunto vacío no se usa PATCH: quitar acceso es `DELETE /usuarios/:id/roles`.
- Migración: `GRANT DELETE ON user_company_roles TO cuadra_app` y CHECK de
  bitácora con `cambiar_rol` y `quitar_rol`.
- Cierre de sesiones del usuario en esa empresa al quedarse sin roles.
- Contrato, hooks y pantalla según el mockup aprobado; espejo y etiquetas de
  bitácora.

## Fuera de alcance

- Desactivar la cuenta global, borrar usuarios, paginación y búsqueda.

## Decisiones tomadas

- **Una sola operación para cambiar (reemplaza el conjunto) y otra para quitar
  acceso**, alineadas con el mockup (el editor con cero roles pasa a «Guardar y
  quitar acceso», que llama a quitar). Bitácora: `cambiar_rol` con roles antes y
  después; `quitar_rol` con los roles quitados.
- **Cambiar = DELETE de los roles que sobran + INSERT de los que faltan**, en una
  transacción; no se concede UPDATE.
- **Último admin**: dentro de la transacción se bloquean (`FOR UPDATE`) las filas
  `admin` de la empresa. Si el objetivo es admin y el resultado deja cero admins,
  se rechaza con 409 y mensaje claro. Vale también para quien se edita a sí mismo.
- **Sesiones**: `DELETE FROM sesiones WHERE user_id = $1 AND company_id = $2`.
  Una sesión tiene una sola empresa elegida, así que solo mueren las elegidas en
  esta. [SUPUESTO: se confirma en T1 con una prueba de integración.]
- **Usuario ajeno a la empresa → 404** (sin filtrar si existe en otra).

## Tareas

- [x] **T1 — Backend.** RED primero (`cambiar-roles.integracion.spec.ts`):
  aislamiento por empresa, 403 no admin, 404 ajeno, `cambiar_rol`/`quitar_rol`
  en bitácora con quién y roles, siguiente petición sin acceso, último admin
  (409), conserva roles en otras empresas, sesiones de la empresa cerradas.
  Servicio, DTO, controlador, migración y pruebas de GRANT y CHECK.
- [x] **T2 — Contrato, hooks y espejo.** Contratos zod, `useCambiarRoles` y
  `useQuitarAcceso` (plantilla `useAccionInvitacionPendiente`), handlers msw,
  errores, acciones/etiquetas/tonos de bitácora con sus pruebas.
- [ ] **T3 — Pantalla.** Acciones en filas activas, editor de roles y confirmar
  quitar según el mockup; textos del error de último admin; pruebas de
  componente y de flujo.
- [ ] **T4 — Cierre.** Suites completas, lint y `format:check`, bitácora
  (`docs/bitacora.md`), estado en `CUADRA.md`, PRs en cadena.

## Aceptación

Los cuatro criterios de la Story 2.6 en `epics.md` (cambio en la siguiente
petición con bitácora; último rol quita la empresa y las sesiones; último admin
protegido; `cuadra_app` solo gana lo mínimo en la migración).

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en backend, DB y frontend |
| T1–T3 | escritor delegado, una tarea a la vez | 2+ archivos no triviales por tarea |

## Progreso

- 2026-10-27: mockup aprobado; exploración hecha; documento creado.
- 2026-10-27 T1 hecha. RED: `cambiar-roles.integracion.spec.ts` con 29 fallidas
  y 2 pasando de 31 (rutas inexistentes, 404). GREEN: 31 de 31.
  Verificación: `npm test` 61 suites, 1301 pruebas, 0 fallas; `typecheck`,
  `lint` (sin cambios no deseados), `prettier --check` y `build` limpios.
  Decisiones: mismo conjunto = 200 sin escribir ni registrar; tras quitar, la
  sesión vieja responde 401 (sus sesiones en la empresa se cierran), no 403;
  candado advisory en vez de `FOR UPDATE`; también se tocó
  `plataforma.esquema.spec.ts` (la prueba de reversibilidad deshace ahora esta
  migración primero). Commit: e4e94f2.
- 2026-10-27 T2 hecha. RED: contrato 5 fallidas, `errores` 7, etiquetas 1,
  tonos 1 y las dos suites de hooks sin resolver el módulo. GREEN tras
  implementar. Verificación (desde `frontend/`): `npm test` 271 archivos,
  4327 pruebas, 0 fallas; `typecheck`, `lint` y `format:check` limpios.
  Decisiones: `api.fetch` ahora admite `PATCH` y `DELETE` (solo el tipo de
  `method` en `shared/api/client.ts`); el 409 se clasifica por código como
  `ultimo_admin`; 409 y 404 no invalidan la lista, un 2xx ilegible sí. Handlers
  msw `PATCH`/`DELETE` mantienen las personas coherentes (`accionRolesFalla`
  fuerza errores). Commit: caed56e.
- Siguiente: T3.
