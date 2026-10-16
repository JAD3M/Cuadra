# v2 · Historia 2.5 — Ver la lista de usuarios de mi empresa

Rama: `feat/v2-2-5-lista-usuarios` (desde `master` tras la 2.4).
Cubre: FR-47. Arquitectura: AD-2, AD-11.
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 2.5). Base: la 2.4
(`odd/tasks/v2-2-4-reenviar-cancelar-invitacion.md`).

## Objetivo

Un `admin` abre Usuarios y ve, en una sola tabla, a cada persona de su empresa
con su correo, sus roles **en esa empresa** y su estado: *Activo* o
*Invitación pendiente* (con «vencida» si caducó). Reenviar y cancelar de la 2.4
viven en la fila de la invitación pendiente. Quien no es `admin` recibe 403 y
no ve la sección.

## Estado actual (exploración)

- `users` (global, `password_hash` NOT NULL: sin cuenta no hay fila) y
  `user_company_roles` (una fila por usuario, empresa y rol, único en los
  tres). `cuadra_app` ya tiene SELECT en ambas: no hace falta GRANT.
- `users`, `user_company_roles` e `invitaciones` no tienen RLS: la empresa se
  impone con `WHERE company_id = $1` explícito tomado de la sesión.
- No existe `GET /usuarios`. Solo `GET /usuarios/invitaciones`
  (`src/usuarios/usuarios.controller.ts`, `@Permiso('usuarios.ver')`,
  `invitaciones-pendientes.service.ts`).
- `usuarios.ver` y `usuarios.gestionar` son solo de `admin`; la entrada de menú
  `usuarios` ya se oculta por `usuarios.ver`
  (`frontend/src/app/shell/navegacion.ts`).
- Frontend: `features/usuarios` muestra el formulario de invitar y la tabla de
  pendientes; no hay lista de usuarios. No hay mockup local de la lista.

## Alcance

- `GET /usuarios`: personas de la empresa (activas con sus roles en esta
  empresa + invitaciones abiertas), `@Permiso('usuarios.ver')`, filtro de
  `company_id` en cada consulta, orden por correo.
- Contrato y hook en el frontend; tabla única con columna de estado y las
  acciones de la 2.4 en las filas pendientes.
- Mockup de Usuarios actualizado (tabla única con estado) y acordado antes de
  escribir la interfaz.

## Fuera de alcance

- Cambiar o quitar roles (2.6).
- Paginación y búsqueda (equipos pequeños; se revisa si aparece la necesidad).

## Decisiones tomadas

- **Tabla única con estado (opción A, acordada el 2026-10-15)**: el criterio
  pide «cada usuario y si su invitación sigue pendiente»; una fila por persona.
- **Solo roles de esta empresa**: la consulta de roles lleva
  `ucr.company_id = $1`; las otras empresas nunca salen.
- **Usuarios con `activo = false` no se listan**: no pueden actuar; la lista
  responde «quién puede hacer qué».
- **Una persona, una fila**: si ya tiene roles en la empresa sale como
  *Activo*; si solo tiene invitación abierta, como *Pendiente*.
- **Gana la fila activa (verificado en T1)**: `invitar-usuarios.service.ts` no
  comprueba si el correo ya es miembro, así que una persona activa puede tener
  invitación abierta a la vez. La lista la muestra solo como activa, con sus
  roles reales. Un usuario inactivo con invitación abierta sale como pendiente.
- **Forma de la fila**: `id` (usuario si activa, invitación si pendiente),
  `email`, `nombre` (nulo en pendiente), `roles`, `estado`, `invitacionId`,
  `vencida`, `venceEn`, `creadaEn`, `invitadaPor`. Roles activos en orden
  alfabético; los de la invitación, en el orden invitado.

## Tareas

- [x] **T1 — Backend `GET /usuarios`.** RED primero: aislamiento por empresa
  (usuario con roles en dos empresas), 403 para contador/revisor/auditor,
  estado pendiente/vencida, orden. Servicio + DTO + controlador + pruebas.
- [x] **T2 — Frontend base.** Contrato zod `usuarios`/`usuario`, hook de
  lectura, claves de query, textos y errores de lectura.
- [x] **T3 — Mockup.** Actualizar Usuarios (oscuro y claro) con la tabla única;
  acordar con el usuario antes de T4. Aprobado por el usuario el 2026-10-15
  (canvas versión 77).
- [x] **T4 — Pantalla.** Tabla única con estado y acciones de la 2.4 en las
  pendientes; estados de carga, vacío y error del mockup.
- [ ] **T5 — Cierre.** Pruebas completas, bitácora, estado en `CUADRA.md`,
  PRs (en cadena si pasa de 400 líneas).

## Rutas y evidencia

- Exploración delegada a un explorador de solo lectura (más de 5 búsquedas).
- T1 y T2: escritor delegado (2+ archivos no triviales).

## Verificación

- Backend: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
  prettier.
- Frontend: `npm test`, `npm run lint`, `npm run format:check`,
  `npm run typecheck`.

## Progreso

T1 hecha (commit en esta rama, ver `git log`). `GET /usuarios` en
`listar-usuarios.service.ts` (una consulta, `company_id = $1` en ambas ramas).
- RED: `npm test -- listar-usuarios` → 10 pruebas fallan con `expected 200 "OK", got 404`.
- GREEN: mismo comando → 10 pasan. `npm test`: 60 suites, 1266 pruebas pasan.
  `npm run typecheck`, `npm run lint`, `npm run build` y prettier sin errores.

T2 hecha (commit en esta rama). Contrato `usuarioListado`/`usuariosListado`,
clave `clavesUsuarios.lista`, hook `useUsuarios`, handler por defecto
`GET /api/usuarios` (lista vacía) en `handlers.ts`; invitar, reenviar y
cancelar invalidan también la lista.
- RED: `npx vitest run usuarios.test.ts useUsuarios.test.tsx` → 3 fallan con
  `ReferenceError: usuarioListado is not defined` y la suite del hook con
  `Failed to resolve import "./useUsuarios"`.
- GREEN: `npm test` (frontend): 269 archivos, 4306 pruebas pasan.
  `npm run lint`, `npm run format:check`, `npm run typecheck` sin errores.
Revisión de T1+T2 aprobada. Observaciones 1 y 2 atendidas en un commit
aparte (la 3 queda para después):
- Prueba de integración del dedup sin distinguir mayúsculas (`Mixta@` vs
  `mixta@`): pasó de entrada, no había bug en el servicio.
- `usuarioListado` rechaza `pendiente` sin `invitacionId`/`venceEn`/`creadaEn`
  y `activo` con `invitacionId`. RED: 2 pruebas fallan con `expected true to
  be false`; GREEN: frontend 4308 pruebas, backend 1267, lint/format/typecheck
  sin errores.

T3 hecha: mockup `Usuarios.dc.html` y `UsuariosClaro.dc.html` aprobados por el
usuario el 2026-10-15 (canvas versión 77).

T4 hecha (commit en esta rama). La tabla «Invitaciones pendientes» se
reemplazó por «Personas de tu empresa» alimentada por `useUsuarios`.
- Columnas: Correo, Roles, Estado, Enviada, Invitada por, Acciones; filas en el
  orden del servidor. Estado: «Activo», «Pendiente · vence en N días» (reglas
  de `vencimiento.ts`, mínimo 1 día) o «Vencida» (decide `vencida` del
  servidor). Activas: «—» en Enviada e Invitada por y celda de acciones vacía;
  pendientes: Reenviar y Cancelar de la 2.4 (mismas decisiones, acciones por
  `invitacionId`). Sin estado vacío; cargando («Cargando personas») y error
  con «Reintentar» como en el mockup.
- Código muerto retirado: `useInvitacionesPendientes`, `clavesUsuarios.pendientes`,
  los esquemas `invitacionPendiente`/`invitacionesPendientes` y sus pruebas;
  la invalidación de invitar, reenviar y cancelar queda solo sobre `lista`.
  `useInvitarUsuario` ahora espera la invalidación (como las acciones).
- Contrato: una activa con `invitacionId`, `venceEn`, `creadaEn` o
  `invitadaPor` no nulos se rechaza.
- Renombres: `ListaUsuarios`, `ListaUsuariosContenedor`, `PERSONAS` en
  `textos.ts`; el handler de pruebas sirve `GET /api/usuarios`.
- Chip vencida: `--color-danger-tint` (no `--color-danger-chip`, reservado a
  la bitácora); activo: tokens `--estado-conciliado-*`.
- RED: `npx vitest run src/features/usuarios src/shared/api/contratos/usuarios.test.ts src/app/usuariosFlujos.test.tsx`
  → 49 pruebas fallan (37 en `ListaUsuarios.test.tsx`, 6 en
  `UsuariosPage.test.tsx`, 3 del contrato `rechaza una activa con venceEn|creadaEn|invitadaPor`
  con `expected true to be false`, 2 de `vencimiento`, 1 de `usuariosFlujos`).
- GREEN: mismo comando → 7 archivos, 107 pruebas pasan. `npm test`: 269
  archivos, 4302 pruebas pasan. `npm run lint`, `npm run format:check` y
  `npm run typecheck` sin errores.

Siguiente paso: T5 (cierre).
