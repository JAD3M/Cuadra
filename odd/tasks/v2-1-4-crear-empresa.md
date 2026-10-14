# v2-1-4 · Crear una empresa con su RFC verificado

Rama: `feat/v2-1-4-crear-empresa` (desde `origin/master` en `e6cde86`; la 1.3 ya estaba integrada)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 1.4, FR-39 parte, FR-49, AD-2, AD-5, AD-7, AD-13). Jira: KAN-119 (ver `jira-mapping.md`).

## Objetivo

Que el dueño, con sesión de plataforma, cree una empresa con nombre y RFC. El RFC se normaliza en el servidor (mayúsculas, sin espacios) antes de compararlo y guardarlo; se rechaza si el formato es inválido, si es uno de los dos genéricos o si ya pertenece a otra empresa. La empresa nace con la separación de funciones activa. La acción queda en `bitacora_plataforma` y en la `bitacora` de la empresa dentro de una sola transacción, y la lista del dueño muestra nombre y RFC.

## Alcance autorizado

- Backend: migración (columna `separacion_funciones`, `GRANT INSERT` por columnas sobre `companies`, acción nueva en el CHECK de `bitacora_plataforma`), `POST` y `GET /plataforma/empresas`, helper compartido de RFC, escritura transaccional de ambas bitácoras, tests.
- Frontend: lista con datos y formulario de alta en `features/plataforma`, espejo de la acción y del helper de RFC, tests.
- Docs: `CUADRA.md`, `docs/bitacora.md` (incluye corregir la afirmación de que `companies` tiene RLS FORCE).
- Fuera de alcance: invitar al primer administrador (1.5), hacer configurable la separación de funciones (épica 5), validar el RFC contra el SAT.

## Decisiones

- **Decidida por la persona usuaria (2026-10-14):** se rechazan los RFC genéricos `XAXX010101000` y `XEXX010101000`; cualquier otro con formato válido se acepta. Solo se valida la forma, no la existencia ante el SAT.
- **Por defecto, revisables (técnicas):**
  - Helper `src/common/rfc.ts` (`normalizarRfc`, `validarRfc`) a partir del regex de `src/cfdi/lector-cfdi.ts`, que pasa a usarlo.
  - `INSERT` en SQL explícito con solo las columnas concedidas (TypeORM emitiría columnas sin GRANT).
  - Duplicado: pre-chequeo más captura de `23505` → 409; la transacción revierte todo.
  - En `bitacora` de empresa `user_id` queda NULL (el dueño no está en `users`); el id del dueño va en `datos`.
  - La escritura de `bitacora_plataforma` en esta transacción lanza error (no usa `RegistroPlataforma.registrar`, que lo traga).
  - Acción nueva `crear_empresa` en `ACCIONES_BITACORA_PLATAFORMA`.

## Hallazgos de la exploración

- `companies` está fuera de RLS (`AislamientoRls.ts:14`); `cuadra_app` solo tiene `SELECT` y `UPDATE (tolerancia_monto)`. Lo que falta es el `GRANT INSERT` por columnas.
- `ux_companies_rfc` ya existe y distingue mayúsculas: normalizar antes de comparar.
- `ACCIONES_BITACORA` ya incluye `crear` y `ENTIDADES_BITACORA` incluye `companies`.
- `TransaccionEmpresa.ejecutar` exige el `company_id` de antemano; aquí el id nace en el `INSERT`, así que se abre la transacción a mano y se hace `set_config('app.company_id', id, true)` después.

## Reglas no negociables que aplican

- Ninguna query del dominio sin `company_id` (la bitácora de empresa se escribe con el `company_id` de la empresa creada).
- `GRANT` de columnas explícitos para `cuadra_app` en la misma migración; nunca `INSERT` de tabla completa.
- El frontend no decide: crear pasa por la API; los valores salen de `tipos.ts`.
- Mockup acordado antes de escribir el formulario.

## Tareas

| ID | Tarea | Ruta | Estado |
|----|-------|------|--------|
| T1 | Helper de RFC compartido (`normalizarRfc`, `validarRfc`, rechazo de genéricos) y `lector-cfdi.ts` lo reutiliza; tests | delegada | [x] `85c719e` |
| T2 | Migración: `companies.separacion_funciones` (`NOT NULL DEFAULT true`), `GRANT INSERT (columnas mínimas)`, nueva acción en `ck_bitacora_plataforma_accion`; entidad, `esquema.spec.ts`, espejo de la acción en backend y frontend con sus tests de deriva | delegada | [x] `341597b` |
| T3 | Servicio y endpoints `POST` y `GET /plataforma/empresas`: normalización, 400/409, una transacción con ambas bitácoras, lista real; corregir el comentario de RLS en el controlador; integración | delegada | [x] `92e432d` |
| T4 | Mockup del formulario y de la lista con datos acordado por la persona usuaria | inline | [x] canvas versión 54, aprobado 2026-10-14 |
| T5 | Frontend: contrato zod, hook de alta, lista con nombre y RFC, formulario, mensajes de error claros, pruebas (MSW + Testing Library) | delegada | [x] `fae968d`, `dc98823` |
| T6 | Docs: `CUADRA.md`, `docs/bitacora.md` | inline | [x] commit de docs |

Cada tarea cierra con un commit convencional en la rama; el hash se anota aquí como evidencia. T4 bloquea a T5.

## Criterios de aceptación

- Crear con nombre y RFC válido inserta la empresa con `separacion_funciones = true` y deja una fila en cada bitácora, en la misma transacción.
- RFC repetido (también con minúsculas o espacios) → 409 claro y no se crea nada.
- RFC con formato inválido o genérico → 400 que nombra qué está mal.
- Si falla cualquiera de las dos bitácoras, no se crea la empresa.
- La lista del dueño muestra nombre y RFC de la empresa creada.
- `cuadra_app` solo puede insertar las columnas concedidas (probado con `has_column_privilege`).

## Checks

`npm run typecheck`, `npm run lint`, `npm test` (backend y frontend). Test-first: RED observado antes de cada implementación con runner disponible.

## Progreso

- Exploración hecha; decisión de RFC genéricos tomada.
- T1 (delegada): `src/common/rfc.ts` con `FORMATO_RFC`, `normalizarRfc`, `validarRfc` (motivo `formato` o `generico`); `lector-cfdi.ts` usa `FORMATO_RFC` sin cambio de comportamiento (los genéricos siguen siendo válidos en un CFDI). RED: el spec no resolvía `./rfc`; GREEN: 39 tests en `src/common` y `src/cfdi`.
- T2 (delegada): migración `CrearEmpresas`, entidad `Company.separacionFunciones` (en `src/companies/company.entity.ts`), acción `crear_empresa` en backend y espejo frontend, tests de privilegio por columna y de reversibilidad ampliado. RED: 2 tests de `esquema.spec.ts` fallaban; GREEN: `src/database` y `src/plataforma` en verde.
- T3 (delegada): `EmpresasPlataforma` (SQL explícito, una transacción, bitácora de plataforma que lanza), `POST`/`GET /plataforma/empresas`, cuerpo `{ razonSocial, rfc }`, 400/409, comentario de RLS corregido. RED: 14 tests fallaban; GREEN: 77 tests en `src/plataforma`. Backend completo: 49 suites, 1069 tests; typecheck y lint limpios.
- T4 (inline): mockup acordado en los artboards 10 y 11 (formulario inline con razón social y RFC, tabla de dos columnas sin estado por decisión de la persona usuaria, errores de formato/genérico bajo el campo, duplicado y red en alerta, aviso de éxito, selector de tema con Sistema). De paso se actualizaron los artboards de la app: barra lateral fija (`sticky`, 100vh; código en `a2332f5`), «Cerrar sesión» y selector de tema en Detalle, Cargas, Tolerancia y Bitácora.
- T5 (delegada): espejo `normalizarRfc`/`validarRfc` en `shared/dominio/rfc.ts` con prueba de deriva contra `src/common/rfc.ts` (`tests/dominio/rfcEspejo.test.ts`); contrato `solicitudCrearEmpresa`/`empresaCreadaPlataforma`; hook `useCrearEmpresaPlataforma` (invalida la lista); `mensajesAlta.ts` (400 se reclasifica con el espejo y nunca se muestra el texto del servidor; 409 y red en alerta); `FormularioCrearEmpresa`, `AvisoEmpresaCreada`, tabla en `EmpresasPlataforma`, botones de crear en encabezado y estado vacío. El cliente solo bloquea campos vacíos: el formato del RFC lo decide el servidor. RED: contrato (3 fallas), helper (módulo ausente) y pantalla (12 fallas); GREEN: 33 tests de plataforma. Frontend completo: typecheck y lint limpios, 247 archivos y 4043 tests en verde.
- Siguiente paso: T6 (docs).
- T6 (inline): entrada del 14 oct en `docs/bitacora.md` (con la corrección sobre RLS de la 1.3) y nota en `CUADRA.md`. Historia 1.4 completa; pendiente armar el PR (en cadena si pasa de 400 líneas).
