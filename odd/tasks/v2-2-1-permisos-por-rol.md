# v2 · Historia 2.1 — Cada rol solo puede hacer lo que le corresponde

Rama: `feat/v2-2-1-permisos-por-rol` (desde `master`).
Cubre: FR-25, FR-53, FR-55. Arquitectura: AD-11, AD-7.
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 2.1), FR-53 en el PRD (líneas 401-430).

## Objetivo

El servidor decide, con una sola matriz de permisos en el backend, qué puede
hacer cada rol (`admin`, `contador`, `revisor`, `auditor`, dueño). Nadie se
salta una regla manipulando la pantalla.

## Estado actual (exploración)

- `ROLES = ['admin','contador','revisor']` en `src/common/entities/tipos.ts:6`; falta `auditor`.
- `@Roles(...)` en `src/common/decorators/decoradores.ts:42`; `RolesGuard`
  (`src/auth/guards/roles.guard.ts`) lee los roles de `user_company_roles` en
  cada petición. Sin `@Roles` solo exige membresía.
- Endpoints solo con membresía hoy: `GET empresa/tolerancia`, `GET casos/:id`,
  `GET bandeja`, `GET bandeja/resumen`, `GET cargas`, `GET cargas/:id`.
- Acceso denegado: `src/bitacora/accesos-denegados.ts` guarda roles
  requeridos y del usuario, pero no un permiso nombrado.
- Prueba de arquitectura modelo: `src/plataforma/arquitectura.spec.ts`.
- Deriva frontend: `frontend/tests/dominio/deriva.test.ts` (hoy afirma 13 listas).

## Alcance

- Matriz FR-53 completa (secciones y acciones) en un solo módulo del backend.
- `@Permiso('<permiso>')` reemplaza a `@Roles` en los endpoints de empresa;
  `RolesGuard` evalúa contra la matriz.
- `auditor` entra a `ROLES` (con migración si hay CHECK sobre el rol).
- Acceso denegado guarda el rol y el permiso que faltó.
- Filas de acciones futuras (verificar muestra, reabrir, descartar, deshacer
  descarte, comentar) ya en la matriz, sin endpoint.
- Espejo en el frontend y prueba de deriva contra el backend.

## Fuera de alcance

- Menús y botones por rol en pantalla (historia 2.2).
- Exponer capacidades en `/auth/contexto` y quitar literales de rol del
  frontend (AD-11; historia 2.2). Aquí solo el espejo y la deriva.
- Construir las acciones futuras (descartar, reabrir, verificar muestra).
- Reenvío de invitaciones, lista de usuarios, cambio de roles (2.3-2.6).

## Decisiones tomadas

- Las acciones condicionadas a ser autor («solo lo que confirmó / descartó»)
  se modelan como permiso con marca `propio`; el guard solo comprueba el rol y
  la historia que construya la acción verifica la autoría.
- Los supuestos del PRD marcados [SUPUESTO] entran como están escritos.
- Dueño no es un rol de empresa: sus permisos se declaran en la matriz pero
  los evalúa la sesión `plataforma`, no `RolesGuard`.

## Tareas

Ruta por tarea y evidencia del disparador se anotan al ejecutar.

- [x] **T1** Matriz de permisos + `auditor` en `ROLES` + migración si aplica, con pruebas unitarias de la matriz (RED primero). Ruta: delegada (escritor). Commit `14ea0e0`.
- [x] **T2** `@Permiso` + `RolesGuard` evalúa la matriz; acceso denegado con rol y permiso; pruebas del guard y del auditor 403 en confirmar, rechazar y cargar. Ruta: delegada. Commit `72bfca7`.
- [x] **T3** Declarar permiso en cada endpoint de empresa de la v1 + prueba de arquitectura (endpoint sin permiso falla). Ruta: delegada. Commit `ba9b62a`.
- [x] **T4** Espejo en frontend + prueba de deriva; cambio de rol aplica en la siguiente petición (prueba de integración). Ruta: delegada. Commit `55b5dad`.
- [ ] **T5** Cierre: `npm test`, `format:check`, bitácora, estado en `CUADRA.md`, PR.

## Criterios de aceptación

Los de la historia en `epics.md`, uno por uno:
matriz única en servidor con deriva; endpoints con permiso y prueba de
arquitectura; auditor 403 sin cambios; denegado en bitácora con rol y permiso;
filas futuras ya presentes; cambio de rol efectivo en la siguiente petición.

## Verificación

- Backend: `npm test` (jest, `--runInBand`); integración con Postgres de `docker-compose.dev.yml`.
- Frontend: `cd frontend && npm test`.
- `format:check` y `lint` en ambos.

## Progreso

T1-T4 hechas y verificadas. Siguiente paso: T5 (cierre: bitácora, estado en
`CUADRA.md`, PR).

## Evidencia

- T1 RED: `matriz.spec.ts` sin `./matriz` (módulo no encontrado); `esquema.spec.ts`
  (`el rol auditor cabe en el CHECK...` violates `ck_invitaciones_rol`) y
  `plataforma.esquema.spec.ts` (reversible) fallaban sin la migración
  `1790709700000-RolAuditor`; `deriva.test.ts` fallaba con
  `ROLES: ... faltan en el espejo: [auditor]`. GREEN tras implementar.
- T2 RED: `roles.guard.spec.ts` (9 fallas: sin `LLAVE_PERMISO`) y
  `accesos-denegados.spec.ts` (sin `datos.permiso`). Integración
  `permisos.integracion.spec.ts`: auditor 403 en confirmar, rechazar, cargar
  CFDI/estado de cuenta y editar tolerancia, con rol y permiso en la bitácora.
- T3 RED: `arquitectura-permisos.spec.ts` (módulo inexistente) y 4 pruebas de
  integración (revisor/auditor en cargas y tolerancia devolvían 200).
- T4 RED: `derivaPermisos.test.ts` sin `@/shared/dominio/permisos`.
- Decisiones: `cargas.ver` y `tolerancia.ver` dan 403 a revisor y auditor
  (FR-53); `GET bancos/perfiles` exige `cargas.cargar`; `muestra.verificar`
  deja la condición «admin solo si no hay revisor» a la historia que la
  construya. Pantallas de cargas y tolerancia siguen en el menú del revisor
  hasta la historia 2.2 (muestran «sin permiso» por el 403).
