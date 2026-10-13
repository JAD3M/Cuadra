# v2-1-3 · Pantalla interna del dueño de Cuadra

Rama: `feat/v2-1-3-pantalla-dueno` (desde `master` en `d8c4821`; la 1.2 ya estaba integrada y subida)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 1.3, FR-67 parte, AD-2, AD-5). Jira: KAN-118 (ver `jira-mapping.md`).

## Objetivo

Que el dueño de Cuadra tenga una cuenta propia (`plataforma_usuarios`, sembrada por comando), inicie sesión de tipo `plataforma` sin `company_id`, y que los dos mundos (empresa y plataforma) queden separados: 403 cruzado con registro, ninguna transacción de empresa sin `company_id`, `bitacora_plataforma` solo con `SELECT` e `INSERT`, y una prueba de arquitectura que impida nombrar las tablas de clase 3 fuera de `plataforma/`.

## Alcance autorizado

- Backend: migración (`plataforma_usuarios`, `bitacora_plataforma`, `sesiones.plataforma_usuario_id` + CHECK), entidades, módulo `src/plataforma/`, scope plataforma en guards y decoradores, comando de siembra, prueba de arquitectura, tests.
- Docs: `CUADRA.md`, `docs/bitacora.md` (incluye cambiar la línea «sesiones `plataforma` responden 401 hasta la 1.3»).
- Frontend: bloqueado hasta que exista y se acuerde el mockup de la pantalla interna (UX-DR1, UX-DR9). Con el mockup acordado, el frontend se trabaja con ODD (T6b y T6c).
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
| T2 | Siembra del dueño: script npm, hash, rechazo si la tabla no está vacía, sin endpoint de alta | delegada | [x] `21d8789` |
| T3 | Sesión plataforma: scope nuevo, login bajo `/plataforma`, `SesionCookieGuard` deja de dar 401 y distingue tipo, 403 cruzado con registro en `bitacora_plataforma`, migrar test de `auth.integracion.spec.ts:1223`, prueba de que el interceptor no abre transacción sin `company_id` | delegada | [x] `d0cefca` |
| T4 | Prueba de arquitectura de clase 3 y módulo `src/plataforma/` con lista de empresas vacía (lectura) | delegada | [x] `b0ea1c6` |
| T5 | Docs: `CUADRA.md`, `docs/bitacora.md` | inline | [x] commit de docs |
| T6a | Mockup de la pantalla interna (artboards 10 y 11 del canvas, versión 43) acordado por la persona usuaria | inline | [x] |
| T6b | Backend: `GET /plataforma/auth/me` (sesión plataforma → `{ usuario: { id, correo } }`, 401/403 como el resto) para restaurar la sesión tras recargar; con test | delegada | [ ] |
| T6c | Frontend: contrato zod, llamadas (`email` en el cuerpo, `correo` en la respuesta), proveedor de sesión de plataforma separado del de empresa, `RutaPlataforma`, `/plataforma/login` y `/plataforma`, textos propios de error, pruebas (MSW + Testing Library) | delegada | [ ] |

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
- T2 hecha (`21d8789`). `sembrarDueno(ds, {correo, password})` en `src/plataforma/sembrar-dueno.ts`, entrada delgada en `src/database/seeds/sembrar-dueno.ts`, `npm run sembrar:dueno` con `DUENO_CORREO` y `DUENO_PASSWORD`. Decisión de la persona usuaria: mínimo de 12 caracteres, solo en esta siembra (el repo no tenía regla). Una transacción con `SHARE ROW EXCLUSIVE` evita dos dueños concurrentes. RED: módulo inexistente; GREEN: 11 de 11; suite completa 1008 de 1009 (solo la intermitente conocida); `typecheck` y `lint` limpios. El CLI no se ejecutó contra la base de desarrollo.
- Nota de routing: el escritor se detuvo una vez por una denegación de permiso (lectura compuesta) y no la rodeó; se retomó con lecturas simples.
- T3 hecha (`d0cefca`, ~700 líneas con specs, sobre la heurística de 400 por el módulo nuevo y un spec de integración de ~400). Login y cierre bajo `/plataforma` (`PlataformaModule`, único que nombra las tablas de clase 3; `sesiones.module.ts` evita el ciclo), mismo 401 genérico y `@Limite`; el cruce de mundos vive en `SesionCookieGuard` (ruta plataforma por `@Scope('plataforma')` o prefijo `/plataforma`; tipo distinto → 403 sin renovar sesión) y registra `acceso_denegado` en `bitacora_plataforma`; `ACCIONES_BITACORA_PLATAFORMA` con CHECK (migración `1790709300000`) y espejo en el frontend; interceptor sin cambios, con spy que prueba que no abre transacción. `GET /plataforma/empresas` devuelve `[]` fijo: `companies` tiene RLS FORCE y leerla sin `company_id` exigiría saltarla (pendiente de 1.4). Los intentos fallidos de login NO se registran (sin usuario conocido y filas controladas por un atacante). RED: módulo `registro-plataforma.service` inexistente; GREEN: suite completa 1028 de 1028, frontend 3964 de 3964; `typecheck` y `lint` limpios. Spot check del padre: `npm test -- src/plataforma src/auth` 148 de 148. Ajustes fuera de la superficie: `frontend/tests/dominio/deriva.test.ts` (12→13), `beforeEach` de `sembrar-dueno.spec.ts` y `ON CONFLICT` en `auth.integracion.spec.ts`.
- Revisión nativa de T1-T3: `gentle-ai review assess` sobre `d8c4821..d0cefca` dio riesgo alto (`hot_path`, auth; 31 archivos, 1810 líneas). Aviso de omisión: la evaluación no se corrió tras T1 ni T2 (se corrió una sola vez, sobre el rango). La persona usuaria declinó la revisión de este candidato («Skip this time»); queda sin registro de revisión y las futuras siguen habilitadas.
- T4 hecha (`b0ea1c6`). `src/plataforma/arquitectura.ts` (helper puro `buscarInfracciones`) y `arquitectura.spec.ts`: palabra completa, sensible a mayúsculas; excluye `plataforma/**`, migraciones y comentarios; lista blanca por archivo y nombre (`database/entidades.ts`, `database/esquema.spec.ts`, `auth/sesion.entity.ts`, `auth/auth.integracion.spec.ts`). Sin infractores reales. La prueba de que puede fallar usa fixtures en memoria. Suite completa 1033 de 1034 antes de corregir un orden en un fixture propio; el padre corrió `arquitectura` 6 de 6. Evaluación nativa: riesgo medio, 197 líneas, `under_budget`, sin revisión.
- T5 hecha: entrada de la 1.3 en `docs/bitacora.md` y nota en D-09 de `CUADRA.md`.
- Historia 1.3, backend cerrada en la rama `feat/v2-1-3-pantalla-dueno`, sin push ni PR. Pendientes: T6 (mockup y frontend), `.env.example` a mano con `DUENO_CORREO` y `DUENO_PASSWORD`, ejecutar la siembra en desarrollo, lista de empresas real en la 1.4.
- Cadena de PRs abierta (Feature Branch Chain, tracker #1 y PRs #2 a #4). Mockup de plataforma publicado en el canvas (artboards 10 y 11) y acordado; la persona usuaria pidió hacer el frontend con ODD (excepción puntual a la regla de SDD de `CLAUDE.md`). Rama `feat/v2-1-3-04-frontend-plataforma`, PR 4/4 de la cadena.
- Mapeo del frontend: no hay endpoint de sesión de plataforma y llamar a `GET /auth/contexto` con cookie de plataforma da 403 y termina la sesión en el cliente de empresa, así que el frontend necesita su propio proveedor y un `me` (decisión por defecto: agregar `GET /plataforma/auth/me`, T6b). `LoginDto` usa `email`; la respuesta usa `correo`. `mensajeDeError` en contexto `login` mapea 403 a «sin empresas», incorrecto para plataforma.
- Siguiente paso: T6b.

## Evidencia de routing

- Mapeo: delegado (más de 5 búsquedas secuenciales).
- T1-T4: escritor delegado (2+ archivos no triviales cada una). T5: inline.
