# v2-1-3 · Pantalla interna del dueño de Cuadra

Rama: `feat/v2-1-3-pantalla-dueno` (desde `master` en `d8c4821`; la 1.2 ya estaba integrada y subida)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 1.3, FR-67 parte, AD-2, AD-5). Jira: KAN-118 (ver `jira-mapping.md`).

## Objetivo

Que el dueño de Cuadra tenga una cuenta propia (`plataforma_usuarios`, sembrada por comando), inicie sesión de tipo `plataforma` sin `company_id`, y que los dos mundos (empresa y plataforma) queden separados: 403 cruzado con registro, ninguna transacción de empresa sin `company_id`, `bitacora_plataforma` solo con `SELECT` e `INSERT`, y una prueba de arquitectura que impida nombrar las tablas de clase 3 fuera de `plataforma/`.

## Alcance autorizado

- Backend: migración (`plataforma_usuarios`, `bitacora_plataforma`, `sesiones.plataforma_usuario_id` + CHECK), entidades, módulo `src/plataforma/`, scope plataforma en guards y decoradores, comando de siembra, prueba de arquitectura, tests.
- Docs: `CUADRA.md`, `docs/bitacora.md` (incluye cambiar la línea «sesiones `plataforma` responden 401 hasta la 1.3»).
- Frontend: bloqueado hasta que exista y se acuerde el mockup de la pantalla interna (UX-DR1, UX-DR9; SDD, un cambio a la vez).
- Fuera de alcance: crear empresas (1.4), vista previa del banco (épica 3), apagar la separación de funciones (épica 5).

## Decisiones

- **Decidida por la persona usuaria:** `sesiones` gana `plataforma_usuario_id` nullable con FK a `plataforma_usuarios` y un CHECK que obliga a uno u otro según `tipo` (`empresa` → `user_id`; `plataforma` → `plataforma_usuario_id`).
- **Por defecto, revisables (técnicas, sin impacto de producto):**
  - Login del dueño en una ruta aparte bajo `/plataforma` (mismos `OrigenGuard` y límite).
  - 403 cruzados en `bitacora_plataforma` (la bitácora de empresa exige `company_id`, que aquí no existe).
  - Siembra como script npm que lee correo y contraseña de variables de entorno, y se niega si `plataforma_usuarios` ya tiene filas.
  - La prueba de arquitectura escanea fuentes fuera de `plataforma/` buscando nombres de tabla y de entidad de clase 3.

## Reglas no negociables que aplican

- Ninguna query del dominio sin `company_id`: las tablas de plataforma son clase 3 y no tocan dominio.
- Hash con el `PasswordHasher` existente (scrypt); nunca texto plano.
- Toda tabla nueva con GRANTs explícitos para `cuadra_app` en la misma migración.

## Tareas

| ID | Tarea | Ruta | Estado |
|----|-------|------|--------|
| T1 | Migración y entidades: `plataforma_usuarios`, `bitacora_plataforma` (solo SELECT/INSERT), `sesiones.plataforma_usuario_id` + FK + CHECK por tipo; actualizar `esquema.spec.ts`; pruebas del CHECK y de los GRANTs | delegada | [x] `1beabe6` |
| T2 | Siembra del dueño: script npm, hash, rechazo si la tabla no está vacía, sin endpoint de alta | delegada | [ ] |
| T3 | Sesión plataforma: scope nuevo, login bajo `/plataforma`, `SesionCookieGuard` deja de dar 401 y distingue tipo, 403 cruzado con registro en `bitacora_plataforma`, migrar test de `auth.integracion.spec.ts:1223`, prueba de que el interceptor no abre transacción sin `company_id` | delegada | [ ] |
| T4 | Prueba de arquitectura de clase 3 y módulo `src/plataforma/` con lista de empresas vacía (lectura) | delegada | [ ] |
| T5 | Docs: `CUADRA.md`, `docs/bitacora.md` | inline | [ ] |
| T6 | Frontend: mockup de la pantalla interna, acuerdo, luego SDD | bloqueada | [ ] |

Cada tarea cierra con un commit convencional en la rama; el hash se anota aquí como evidencia.

## Criterios de aceptación

Los de la Story 1.3 en `epics.md` (líneas 339-377).

## Verificación

- Backend: `npm run typecheck`, `npm run lint`, `npm test` (Postgres y Redis reales: `docker compose up -d postgres redis`).
- Falla conocida e intermitente: `src/cargas/cargas.listado.integracion.spec.ts:336` y un caso de `src/database/esquema.spec.ts`.

## Progreso

- Mapeo de solo lectura hecho (explorador): `ck_sesiones_tipo` ya admite `plataforma` y `company_id` nulo; `SesionCookieGuard` da 401 a todo tipo distinto de `empresa`; el interceptor solo abre transacción con `scope==='sesion'`; no existen las tablas de plataforma, `src/plataforma/` ni prueba de arquitectura; `AccesosDenegados` solo escribe por empresa.
- T1 hecha (`1beabe6`). Migración `1790709200000-PlataformaUsuarios`, entidades en `src/plataforma/`, `Sesion.plataformaUsuario` por nombre (sin importar clase 3 fuera de `plataforma/`). RED: 22 de 22 fallaban sin la migración. GREEN: 22 de 22; suite completa 45 suites, 998 tests; `typecheck` y `lint` limpios. Ajustes mínimos: `SesionCookieGuard` rechaza con 401 una sesión empresa sin `userId`; el test de plataforma en `auth.integracion.spec.ts` crea su `plataforma_usuarios` (T3 lo migra a 403). La migración borra sesiones `plataforma` previas (no podían existir: el guard daba 401).
- Pendiente de T3 (AD-7): `bitacora_plataforma.accion` no tiene CHECK; se agrega cuando se definan los valores (`acceso_denegado`, etc.) junto con `tipos.ts`, su espejo en el frontend y la prueba de deriva.
- Riesgo anotado: el test de reversibilidad usa `undoLastMigration()`; si se agrega otra migración después, hay que actualizarlo.
- Siguiente paso: T2 (siembra del dueño).

## Evidencia de routing

- Mapeo: delegado (más de 5 búsquedas secuenciales).
- T1-T4: escritor delegado (2+ archivos no triviales cada una). T5: inline.
