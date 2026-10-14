# v2-1-6 · Recuperar la contraseña por correo

Rama: `feat/v2-1-6-recuperar-contrasena` (desde `master` en `5bdb4f7`; la 1.5 ya estaba integrada)
Fuente: `_bmad-output/planning-artifacts/epics.md:451-480` (Story 1.6, FR-43 recuperación, FR-44, AD-6, AD-14, AD-15). Jira: KAN-121.

## Objetivo

Que una persona de una empresa recupere su contraseña desde un enlace de un solo uso enviado a su correo, sin pedirle nada al dueño. La respuesta al pedir el enlace es idéntica exista o no la cuenta.

## Alcance autorizado

- Backend: migración (`tokens_recuperacion` clase 2, GRANT UPDATE de `password_hash` en `users`, acciones de bitácora), endpoints públicos para pedir, consultar y restablecer, borrado de todas las sesiones del usuario, política de contraseña extraída a un solo lugar, tests.
- Frontend: pantalla «olvidé mi contraseña», pantalla de restablecer, enlace desde el login, tests.
- Docs: `CUADRA.md`, `docs/bitacora.md`.
- Incluye la cuenta del dueño de plataforma (`plataforma_usuarios`, decisión del 2026-10-14).
- Fuera de alcance: cambio de contraseña con sesión abierta, cualquier cambio de política más allá de extraerla.

## Decisiones

- **Por defecto, revisables (sin impacto de producto):**
  - Token de 32 bytes en base64url; solo se guarda su SHA-256; vigencia de 1 hora. Reutiliza `nuevoToken()` y `huellaDeToken()`.
  - El token es por usuario (`users` no tiene `company_id`), con índice único parcial: un solo enlace vivo por usuario. Pedir uno nuevo marca el anterior como reemplazado.
  - Solo cuentas `activo = true`; el correo se normaliza con `normalizarEmail`. Si no existe o está inactiva, misma respuesta y no se envía nada.
  - Correo enviado después del commit; `@Limite` con `contarExitos: true` en la ruta de pedir.
  - Restablecer borra todas las filas de `sesiones` del usuario en la misma transacción y no abre sesión: la persona entra por el login.
  - Contraseña nueva con la política v1 (mínimo 12, máximo 256), extraída a un validador compartido por invitaciones y recuperación.
  - Enlace usado o caducado: 410 con motivo y mensaje claro; token desconocido: 404; `GET` siempre 200 con `estado`, como en invitaciones.
- **Decidida por la persona usuaria (2026-10-14):** la recuperación incluye también la cuenta del dueño de plataforma (`plataforma_usuarios`). Plan aprobado para T1 a T3.

## Reglas no negociables que aplican

- Tabla nueva con GRANTs explícitos para `cuadra_app` en la misma migración.
- El token nunca se guarda ni se registra en claro.
- El frontend no decide: pedir y restablecer pasan por la API.
- Mockup acordado antes de escribir el frontend.

## Tareas

| ID | Tarea | Ruta | Estado |
|----|-------|------|--------|
| T1 | Migración `tokens_recuperacion` + GRANTs (incl. `UPDATE (password_hash, updated_at)` en `users`) + acciones de bitácora, entidad, espejo en frontend y pruebas de esquema y deriva | delegada | [x] |
| T2 | Validador de política de contraseña compartido (invitaciones y recuperación) con sus pruebas | delegada | [x] |
| T3 | Backend: pedir (respuesta uniforme, correo tras commit, límite), consultar y restablecer (consume token, actualiza contraseña, borra sesiones), integración | delegada | [x] |
| T4 | Mockup de «olvidé mi contraseña» y «restablecer» (estados: vigente, inválido, usado, caducado, enviado) acordado por la persona usuaria | inline | [x] canvas versiones 62-63, aprobado 2026-10-14 |
| T5 | Frontend: enlace desde el login, dos pantallas públicas, tests | delegada | [x] a57a50e, a7ebc58, cb6ecb8 |
| T6 | Docs: `CUADRA.md`, `docs/bitacora.md` | inline | [ ] |

Cada tarea cierra con un commit convencional; el hash se anota aquí.

T4 bloquea a T5.

- T1: commit ff004bb "feat(auth): tabla de tokens de recuperación y acción de bitácora de plataforma"
- T2: commit "refactor(auth): extraer la política de contraseña v1 a un validador compartido" (e874d08)
- T5: commits a57a50e (contrato, textos, hooks, estados terminales), a7ebc58 (pantallas y rutas públicas), cb6ecb8 (enlace en el login)
- T3: commit "feat(recuperacion): pedir, consultar y restablecer la contraseña por correo" (e2eebd2)

## Criterios de aceptación

- Pedir recuperación responde igual con o sin cuenta; si existe, guarda token con hash y 1 hora de vigencia y envía el enlace.
- Un enlace vigente con contraseña válida actualiza la contraseña, consume el token y borra todas las sesiones del usuario.
- Enlace usado o caducado se rechaza con mensaje claro y no cambia nada.
- Pedir un enlace nuevo deja inservible el anterior.
- La ruta de pedir aplica el límite de la 1.2.

## Progreso

Plan creado.

- T2 hecha: `src/common/politica-contrasena.ts` (+ spec, RED observado); invitaciones la usa. Verificado: spec unitaria verde y `tsc --noEmit` limpio. Las pruebas de integración de invitaciones no se pudieron correr: no hay Postgres/Redis ni Docker activo en este entorno.
- T1 y T3 bloqueadas por superficies fuera de lo autorizado (ver reporte): `src/plataforma/arquitectura.spec.ts` (regla AD-2), `src/plataforma/plataforma.esquema.spec.ts` (undoLastMigration), un servicio en `src/plataforma/`, y `frontend/src/features/bitacora/tonos.ts` si se agrega acción a `ACCIONES_BITACORA`.
- T1 hecha (ff004bb): migración `1790709600000-TokensRecuperacion` (tabla clase 2, CHECK de una sola cuenta, un índice vivo por cuenta, GRANTs por columna incl. `UPDATE (password_hash, updated_at)` en `users`, `restablecer_contrasena` en el CHECK de plataforma), entidad, espejo en frontend, lista blanca AD-2 y specs de esquema, deriva y reversibilidad. Desviación: la migración se escribió antes que las pruebas de esquema (no se observó RED).
- T3 hecha: módulo `src/recuperacion/` (POST pedir con `@Limite` y `contarExitos`, GET estado, POST restablecer) y `RecuperacionPlataforma` en `src/plataforma/` para la cuenta del dueño (AD-2). Si el mismo correo existe en los dos mundos, cada cuenta recibe su propio correo y enlace. Un fallo de envío se registra y no cambia la respuesta (un error delataría la cuenta). El enlace del correo es `<ORIGEN_AUTORIZADO>/recuperar/<token>`: T4/T5 deben usar esa ruta. Nota técnica: `qr.query` de TypeORM devuelve `[filas, n]` en UPDATE/DELETE, por eso se verifica con SELECT ... FOR UPDATE antes de actualizar.
- T5 hecha: `/recuperar` y `/recuperar/:token` públicas sin guarda (como la invitación: no redirigen con sesión viva; restablecer no abre sesión y ofrece ir al login). Pedir muestra siempre `enviado`; alerta solo en red/429/5xx. Un 410 al guardar relee el enlace para mostrar su motivo. El enlace del login entra por un slot `enlaceOlvido` de `FormularioLogin` para que siga sin importar el enrutador. Reutiliza `LARGO_MINIMO_CONTRASENA` de invitaciones. Textos y estados tal cual el mockup; único añadido: «Enviando…» / «Guardando…» mientras hay petición. Verificado: typecheck, lint y 4155 pruebas verdes (RED observado antes de implementar).
