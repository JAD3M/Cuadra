# v2 · Historia 2.3 — Invitar usuarios a mi empresa con uno o más roles

Rama: `feat/v2-2-3-invitar-usuarios` (desde `master` tras la 2.2).
Cubre: FR-41, FR-50 (invitaciones). Arquitectura: AD-14, AD-7.
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 2.3). Base: la
historia 1.5 (`odd/tasks/v2-1-5-invitar-administrador.md`), que invita al primer
administrador desde la plataforma del dueño.

## Objetivo

Un `admin` invita por correo a su gente eligiendo uno o más roles entre
`admin`, `contador`, `revisor` y `auditor`; la respuesta no revela si el correo
tiene cuenta, la acción queda en la bitácora y el límite de peticiones aplica.

## Estado actual (exploración)

- `invitaciones` (`src/auth/invitacion.entity.ts:15-63`): un solo `rol`
  (`ck_invitaciones_rol`), `invitada_por_plataforma_usuario_id` NOT NULL, índice
  vivo único `(company_id, email)`. Migración `1790709500000-Invitaciones.ts`.
- Aceptación pública (`src/invitaciones/invitaciones.service.ts:100-190`):
  reutiliza la cuenta existente o crea una nueva; inserta UN rol con
  `ON CONFLICT DO NOTHING`.
- Invitar desde plataforma: `src/plataforma/invitaciones-plataforma.service.ts`
  (`ROL_INVITADO = 'admin'`, bitácora de plataforma con `user_id` nulo,
  `@Limite({intentos:20, ventanaS:3600, contarExitos:true})`).
- `user_company_roles`: una fila por rol, único `(user_id, company_id, rol)`;
  los roles se leen en cada petición.
- `usuarios.gestionar` ya existe en la matriz (solo `admin`).
- `invitar` ya está en `ACCIONES_BITACORA` y en `ck_bitacora_accion`.
- Frontend: solo la pantalla de aceptación (`features/invitaciones`); no hay
  pantalla de usuarios de empresa ni mockup de ella.

## Alcance

- Migración reversible: `roles text[]` en `invitaciones` (con CHECK de que no
  está vacío y todos son roles válidos) en lugar de `rol`, y
  `invitada_por_user_id` nullable con CHECK de que exactamente un invitador
  está presente.
- La aceptación asigna todos los roles de la invitación; la invitación de
  plataforma sigue siendo `['admin']`.
- `POST /usuarios/invitaciones` con `@Permiso('usuarios.gestionar')`, límite de
  peticiones, respuesta idéntica exista o no la cuenta, correo con el mismo
  enlace, y acción `invitar` en la bitácora de la empresa con quién invitó y los
  roles.
- Mockup de la pantalla de Usuarios (invitar con roles) acordado antes de la
  interfaz; después la interfaz.

## Fuera de alcance

- Reenviar o cancelar invitaciones (2.4), lista de usuarios (2.5), cambiar o
  quitar roles (2.6).

## Decisiones tomadas

- `roles text[]` con CHECK (sin tabla hija): una invitación es un valor
  inmutable con sus roles; la unicidad por terna ya vive en
  `user_company_roles`.
- Una invitación viva por `(company_id, email)`: invitar de nuevo la reemplaza
  con el patrón transaccional existente.
- El backend va primero y no depende del mockup; la interfaz espera al mockup
  aprobado.

## Delivery

Estrategia de cadena `stacked-to-main` (la elegida en la 2.1), una rebanada por
unidad de trabajo.

## Tareas

- [x] **T1** Migración y entidad (`roles[]`, invitador de empresa), aceptación con todos los roles, ajustes de plataforma y de las pruebas de esquema. Ruta: delegada (escritor). Commit: `cd186fc`.
- [x] **T2** `POST /usuarios/invitaciones`: permiso, límite, respuesta uniforme, correo, bitácora con invitador y roles; pruebas de 403 con acceso denegado. Ruta: delegada (escritor). Commit: ver `git log` (`feat(usuarios)`).
- [x] **T3** Mockup de la pantalla de Usuarios (invitar con roles), oscuro y claro, acordado con el usuario. Aprobado por el usuario el 2026-10-15 (`Usuarios.dc.html` y `UsuariosClaro.dc.html`).
- [x] **T4** Interfaz: formulario de invitar con roles y mensajes, sobre el mockup aprobado. Ruta: delegada (escritor). Commit: ver `git log` (`feat(frontend)`).
- [x] **T5** Cierre: pruebas completas, bitácora, PRs en cadena. Ruta: inline. Cinco rebanadas `stacked-to-main`; `CUADRA.md` no cambia (sigue el estado de la v1).

## Criterios de aceptación

Los de la historia en `epics.md`: invitación con token de un solo uso, 7 días
y roles elegidos; `invitar` en la bitácora con quién y a qué roles; cuenta
existente conserva roles de otras empresas; 403 con acceso denegado sin rol
admin; respuesta idéntica con o sin cuenta; límite de peticiones; mockup
acordado antes de la interfaz.

## Verificación

- Backend: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
  prettier sobre `src` y `scripts`.
- Frontend: `cd frontend && npm test`, `npm run lint`, `npm run format:check`,
  `npm run typecheck`.
- `docs/bitacora.md` no se pasa por prettier.

## Progreso

T1 hecha (migración `1790709800000-InvitacionesMultirol`, entidad, aceptación con todos los roles). T2 hecha: `POST /usuarios/invitaciones` (`src/usuarios/`), `@Permiso('usuarios.gestionar')`, `@Limite({20, 3600, contarExitos})` igual que plataforma, respuesta `{ email, roles }`, bitácora `invitar` con `user_id` del invitador en la transacción de la petición y correo tras el COMMIT (503 si falla). T3 hecha: mockup aprobado por el usuario el 2026-10-15. T4 hecha: ruta `/usuarios` con elemento de menú «Usuarios» (`usuarios.ver`) tras Tolerancia, formulario con correo y los cuatro roles (`usuarios.gestionar`), contratos zod `solicitudInvitarUsuario` / `invitacionUsuarioEnviada`, descripciones de rol en `shared/dominio` y estados enviando, éxito, error_correo, error_roles, límite (429), error_envio (503), error_conexion y error_permiso (403). Siguiente paso: T5 (cierre).

## Evidencia

T1: RED observado (column "roles" does not exist en esquema, plataforma.esquema e invitaciones); GREEN: npm test 58 suites / 1211 pruebas, typecheck, eslint, build y prettier --check limpios. Sin GRANT nuevo: INSERT de tabla ya cubre las columnas nuevas.

T2: RED observado (`Cannot find module './usuarios.module'`); GREEN: 16 pruebas de `src/usuarios/invitar-usuarios.integracion.spec.ts`; npm test 59 suites / 1227 pruebas, typecheck, eslint, build y prettier --check limpios.

T4: RED observado (`Failed to resolve import "./usuarios"`, `"./errores"` y `"./UsuariosPage"`; `DESCRIPCIONES_ROL` indefinido; menú sin «Usuarios» en `navegacion.test.ts` y en los flujos de la app); GREEN: `npm test` 266 archivos / 4224 pruebas, `npm run lint`, `npm run format:check` y `npm run typecheck` limpios.
