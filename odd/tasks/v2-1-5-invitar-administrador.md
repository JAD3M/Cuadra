# v2-1-5 · Invitar al primer administrador y aceptar la invitación por correo

Rama: `feat/v2-1-5-invitar-administrador` (desde `master` en `f4cd5d0`; la 1.4 ya estaba integrada)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 1.5, FR-39, FR-40, FR-43, FR-48, FR-61, AD-14, AD-5, AD-6, AD-7, AD-15). Jira: KAN-120 (ver `jira-mapping.md`).

## Objetivo

Que el dueño invite por correo a la primera persona administradora de una empresa y que esa persona acepte con un enlace de un solo uso, sin que el dueño conozca ni maneje su contraseña. La respuesta al invitar es idéntica exista o no la cuenta. El correo sale por un puerto `ProveedorCorreo` con adaptador simulado en desarrollo y pruebas y adaptador real por variables de entorno.

## Alcance autorizado

- Backend: puerto `ProveedorCorreo` y adaptadores, validación de entorno, migración (`invitaciones` clase 2, GRANTs por columna sobre `users` y `user_company_roles`, acción `invitar` en las dos bitácoras), endpoint del dueño para invitar, endpoints públicos para consultar y aceptar el enlace, opción del límite para contar envíos exitosos, tests.
- Frontend: acción de invitar desde la lista de empresas y página pública de aceptación, espejo de la acción, tests.
- Docs: `CUADRA.md`, `docs/bitacora.md`, `.env.example`.
- Fuera de alcance: reenviar y cancelar invitaciones (épica 2), invitar con otros roles (2.3), recuperar contraseña (1.6).

## Decisiones

- **Decidida por la persona usuaria (2026-10-14):** si el correo ya tiene cuenta, aceptar la invitación **no toca su contraseña**: solo agrega el rol `admin` en esa empresa y abre sesión.
- **Por defecto, revisables (técnicas, sin impacto de producto):**
  - Token de 32 bytes aleatorios en base64url; solo se guarda su SHA-256. Vigencia de 7 días.
  - Una invitación nueva al mismo correo y empresa invalida la anterior (el enlace viejo se rechaza como reemplazado).
  - Se permite invitar aunque la empresa ya tenga un administrador (la historia no lo prohíbe).
  - El enlace usa `ORIGEN_AUTORIZADO` como base; no se agrega variable nueva.
  - Adaptador real por SMTP con variables `CORREO_SMTP_HOST`, `CORREO_SMTP_PORT`, `CORREO_SMTP_USUARIO`, `CORREO_SMTP_PASSWORD` y `CORREO_REMITENTE`; en producción faltan todas o alguna y el arranque falla nombrándolas.
  - El correo se envía igual exista o no la cuenta, después del commit, y la respuesta tiene el mismo cuerpo, código y forma.
  - `@Limite` gana una opción para contar también los envíos exitosos, solo en la ruta de invitar.
  - En `bitacora` de empresa `user_id` queda NULL (el dueño no está en `users`) y el id del dueño va en `datos`, como en la 1.4.

## Reglas no negociables que aplican

- Ninguna query del dominio sin `company_id`: la escritura en `bitacora` de empresa fija `app.company_id` en la misma transacción.
- Tabla nueva con GRANTs explícitos para `cuadra_app` en la misma migración.
- El token nunca se guarda ni se registra en claro.
- El frontend no decide: invitar y aceptar pasan por la API.
- Mockup acordado antes de escribir el frontend.

## Tareas

| ID | Tarea | Ruta | Estado |
|----|-------|------|--------|
| T1 | Puerto `ProveedorCorreo`, adaptador simulado legible por pruebas y adaptador SMTP, validación de entorno que nombra las variables faltantes en producción, `.env.example` | delegada | [ ] |
| T2 | Migración: `invitaciones` (clase 2), GRANTs por columna en `users` y `user_company_roles`, acción `invitar` en los CHECK de `bitacora` y `bitacora_plataforma`, espejo en el frontend y pruebas de esquema y deriva | delegada | [ ] |
| T3 | Opción de `@Limite` para contar envíos exitosos, con sus pruebas | delegada | [ ] |
| T4 | Backend: invitar (dueño) con respuesta uniforme y doble bitácora transaccional; consultar y aceptar el enlace (público) con cuenta nueva o reutilizada sin tocar su contraseña, consumo del token y sesión; integración | delegada | [ ] |
| T5 | Mockup de invitar desde la lista y de la página de aceptación (cuenta nueva, cuenta existente, enlace inválido, usado, caducado o reemplazado) acordado por la persona usuaria | inline | [ ] |
| T6 | Frontend: invitar desde la lista, página pública de aceptación, tests | delegada | [ ] |
| T7 | Docs: `CUADRA.md`, `docs/bitacora.md` | inline | [ ] |

Cada tarea cierra con un commit convencional en la rama; el hash se anota aquí como evidencia. T5 bloquea a T6.

## Criterios de aceptación

- Invitar crea una invitación con token de un solo uso guardado con hash y caducidad de 7 días, envía el correo con el enlace y deja `invitar` en las dos bitácoras en la misma transacción.
- La respuesta al invitar es idéntica con o sin cuenta existente.
- Aceptar con un enlace vigente crea la cuenta (con la contraseña elegida) o reutiliza la existente sin tocar su contraseña, da el rol `admin` en esa empresa, consume la invitación y abre sesión.
- Enlace usado, caducado o reemplazado se rechaza con mensaje claro y no cambia nada.
- Sin variables de correo en desarrollo y pruebas se usa el adaptador simulado; en producción sin ellas el arranque falla nombrando cuáles faltan.
- La ruta de invitar aplica el límite de la 1.2 también con envíos exitosos.

## Checks

`npm run typecheck`, `npm run lint`, `npm test` (backend y frontend). Test-first: RED observado antes de cada implementación con runner disponible.

## Progreso

- Exploración hecha; decisión sobre cuentas existentes tomada. Siguiente paso: T1.
