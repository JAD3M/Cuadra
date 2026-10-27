# v2 · Historia 2.7 — Consultar la bitácora según mi rol

Ramas en cadena (una por tarea, cada una sobre la anterior):
`feat/v2-2-7-01-pruebas-bitacora` → `feat/v2-2-7-02-frontend-detalle` →
`feat/v2-2-7-03-frontend-pantalla`.
Cubre: FR-51 (deja visibles FR-50 y FR-55). Arquitectura: AD-7.
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 2.7). Base: la 2.6
(`odd/tasks/v2-2-6-cambiar-quitar-roles.md`).

## Objetivo

Las cuatro personas con rol (`admin`, `contador`, `revisor`, `auditor`) abren la
bitácora de su empresa y ven también las entradas de administración (invitar,
reenviar, cancelar, cambiar rol, quitar rol) con un detalle en español que dice
a quién y qué roles. Las entradas de acceso denegado dicen rol, permiso que
faltó y cuándo. Nadie puede modificar ni borrar entradas, y una prueba lo
demuestra. Otra empresa no ve nada de la ajena.

## Estado actual (exploración, 2026-10-27)

- Backend casi completo: `GET /bitacora` y `GET /bitacora/usuarios` con
  `bitacora.ver` para los cuatro roles (`src/auth/permisos/matriz.ts:60`),
  filtro `company_id` en el servicio y RLS; sin rutas de escritura.
- Inmutabilidad: `cuadra_app` solo tiene `SELECT, INSERT` sobre `bitacora`
  (`bitacora-solo-lectura.integracion.spec.ts`, UPDATE/DELETE/TRUNCATE = 42501).
  Falta una prueba de rutas sobre `/bitacora` y `/bitacora/:id`; solo existe la de
  `/bitacora/usuarios` (USR-5).
- Aislamiento: AU-24 cubre otra empresa, pero no con las acciones de
  administración ni `acceso_denegado`.
- Frontend: etiquetas y tonos de las acciones de administración ya existen.
  `features/bitacora/detalle.ts` devuelve «—» para ellas (brecha principal) y
  `acceso_denegado` no muestra `datos.permiso`.
- `frontend/tests/dominio/bitacoraAislamiento.test.ts:145` prohíbe `email`,
  `correo`, `ip` y `userAgent` en `features/bitacora` (regla D8).
- Mockup de Bitácora con cambiar/quitar rol, permiso faltante y estado vacío
  actualizado: aprobado el 2026-10-27 (canvas versión 81).

## Alcance

- Pruebas de backend (sin migración): los cuatro roles ven las acciones de
  administración y `acceso_denegado`; aislamiento A/B de esas acciones; ninguna
  ruta de escritura sobre `/bitacora` ni `/bitacora/:id`.
- `detalle.ts`: frases en español para invitar, reenviar, cancelar,
  cambiar_rol y quitar_rol; permiso en `acceso_denegado` (también cuando la
  denegación es por segregación de funciones).
- Filtro de acción y estado vacío con las acciones nuevas; pruebas de flujo por
  rol.

## Fuera de alcance

- Cambios de esquema, nuevos permisos, tema claro de la bitácora (el canvas no
  tiene `BitacoraClaro`), exportar la bitácora.

## Decisiones tomadas

- **Se muestra el correo de la persona afectada a los cuatro roles** (acordado el
  2026-10-27 al aprobar el mockup). La regla D8 se acota: `email` se permite solo
  para el detalle de las acciones de administración; `ip` y `userAgent` siguen
  prohibidos.
- **Textos del mockup** (derivados de `datos`): invitar «correo · vence en 7
  días» solo si el dato existe; cambiar_rol «correo · roles: A → B»; quitar_rol
  «correo · roles quitados: X»; acceso_denegado «MÉTODO ruta · rol insuficiente:
  requiere X, tiene Y · permiso: p». Nunca se inventa un dato que `datos` no trae.
- **Sin migración**: el backend ya cumple los GRANTs; T1 solo agrega pruebas.

## Tareas

- [x] **T1 — Backend (pruebas).** RED primero cuando exista un hueco real: si una
  prueba pasa de inmediato porque el comportamiento ya existe, se documenta como
  excepción (pruebas de caracterización) y se confirma que falla si se rompe la
  regla (mutación manual o aserción negativa). Pruebas: cuatro roles ×
  acciones de administración y `acceso_denegado`; aislamiento A/B; sin rutas de
  escritura sobre `/bitacora` y `/bitacora/:id`.
- [x] **T2 — Frontend: dominio y detalle.** `detalle.ts` con las frases, permiso
  en `acceso_denegado`, regla D8 acotada, espejo de `datos` en
  `bitacoraEspejo.test.ts` y `VACIO.detalle`, con pruebas.
- [x] **T3 — Pantalla.** Filtro de acción con las acciones nuevas, entidad
  `companies`, pruebas de flujo para cada rol según el mockup aprobado.
- [x] **T4 — Cierre.** Suites completas, lint y `format:check`, bitácora
  (`docs/bitacora.md`), PRs en cadena.

## Aceptación

Los cinco criterios de la Story 2.7 en `epics.md`.

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en backend y frontend |
| T1–T3 | escritor delegado, una tarea a la vez | 2+ archivos no triviales por tarea |

## Progreso

- 2026-10-27: mockup aprobado; exploración hecha; documento creado.
- 2026-10-27, T1 hecha (pruebas de caracterización, sin hueco real; cero cambios
  de producción). Archivos: `src/bitacora/bitacora-administracion.integracion.spec.ts`
  (15 pruebas) y dos pruebas nuevas en `bitacora-solo-lectura.integracion.spec.ts`
  (sin GRANT UPDATE por columna; `cuadra_app` ni dueño ni superusuario).
  - Cobertura: cuatro roles × seis acciones con su `datos` (las de administración
    con el mismo INSERT que los servicios; `acceso_denegado` por el 403 real de
    `POST /cargas/cfdi`); aislamiento A/B en lista, `total`, `accion`, `userId` y
    `entidadId`; POST/PUT/PATCH/DELETE sobre `/bitacora` y `/bitacora/:id` = 404
    y filas intactas; `GET /bitacora/:id` = 404 (no existe, no filtra); sin sesión
    esas rutas dan 404, no 401 (la ruta no existe).
  - Se comprobó que pueden fallar (mutación temporal, revertida, `git diff` limpio
    en producción): quitar `auditor` de `bitacora.ver` en la matriz = 1 roja
    (auditor); `@Post()` en el controlador = 2 rojas (escritura); quitar el filtro
    `company_id` del servicio = 15/15 verdes porque RLS lo cubre; quitar filtro y
    RLS de `bitacora` a la vez = 8 rojas (aislamiento); solo RLS fuera = verde
    (el filtro del servicio basta). Son dos barreras independientes y la prueba
    detecta la fuga si caen las dos. `GRANT UPDATE (datos)` temporal = 1 roja en
    la prueba de columnas.
  - Verificación: `npm test -- --runInBand` 62 suites / 1318 pruebas verdes
    (una primera corrida completa tuvo 2 fallas intermitentes en
    `bitacora-solo-lectura` y `auth.integracion`, que pasan solas y en la
    segunda corrida completa); `npm run typecheck`, `npm run lint` (sin cambios
    extra), `prettier --check` y `npm run build` limpios.
- Commit T1: `a93dc7e`.
- 2026-10-27, T2 hecha (rama `feat/v2-2-7-02-frontend-detalle`). RED primero:
  19 pruebas rojas en `detalle.test.ts` (`expected '—' to be 'correo: …'`,
  permiso ausente, segregación) y `EstadosBitacora.test.tsx` (texto vacío); 1
  roja en `bitacoraAislamiento.test.ts` («detalle.ts es el único archivo que
  nombra el correo»). Luego GREEN.
  - `detalle.ts`: frases de invitar, reenviar, cancelar, cambiar_rol y quitar_rol
    solo con campos de `datos` (sin vencimiento: `datos` no lo trae; invitar usa
    roles); `acceso_denegado` agrega `· permiso: p`; la segregación (traslape de
    roles) ya no da «—»: muestra `MÉTODO ruta[ · permiso: p]` sin afirmar roles.
    Rol desconocido sale tal cual; sin dato usable, «—».
  - D8 acotada: `email`/`correo` solo en `detalle.ts`; `ip`/`userAgent` prohibidos
    en toda la feature; pruebas de que la regla falla en otro archivo.
  - `VACIO.detalle` actualizado (y su prueba en `EstadosBitacora.test.tsx`).
  - Sin cambios en contratos, etiquetas ni `bitacoraEspejo.test.ts` (no espeja `datos`).
  - Verificación (frontend/): `npx vitest run` 272 archivos / 4379 pruebas verdes;
    `npm run typecheck`, `npm run lint`, `npm run format:check` limpios.
- Commit T2: `05dc82f`.
- Siguiente: T3.
- 2026-10-27, T3 hecha (rama `feat/v2-2-7-03-frontend-pantalla`). Brecha real
  contra el mockup: el filtro de Acción y el chip de la tabla mostraban el valor
  crudo (`invitar`, `cambiar_rol`…) en vez de «Invitación enviada», «Invitación
  reenviada», «Invitación cancelada», «Rol cambiado», «Rol quitado».
  - RED primero: `bitacoraAdministracion.test.tsx` 14 rojas / 10 verdes
    (`Unable to find an accessible element with the role "option" and name
    "Invitación enviada"`; el chip igual; la lista de opciones traía `invitar`…).
  - Cambios de producción: `features/bitacora/textoAccion.ts` (nuevo: etiqueta en
    español solo para las cinco de administración, el resto con el valor de la
    API), usado por `TablaBitacora.tsx` (chip) y `FiltrosBitacora.tsx` (opciones;
    el `value` sigue siendo el de la API); `ACCIONES_ADMINISTRACION` en
    `shared/dominio/acciones.ts` (con `satisfies AccionBitacora`). Tono neutral y
    entidad `companies` ya estaban bien. Se ajustaron `TablaBitacora.test.tsx` y
    `FiltrosBitacora.test.tsx` (esperaban el valor crudo) y se agregó
    `textoAccion.test.ts`.
  - Pruebas de flujo por rol (admin, contador, revisor, auditor: fila de cada
    acción de administración con etiqueta/tono/usuario/`companies`+id/detalle,
    `acceso_denegado` con rol+permiso+cuándo y estilo de peligro, filtro por
    «Rol cambiado» etc., sin botones/enlaces de editar o borrar y solo GET) y
    estado vacío / vacío con filtros. Pasaron de inmediato (caracterización) las
    de `acceso_denegado`, solo lectura y vacío; se comprobó que fallan con
    mutación temporal (revertida): quitar la clase de fila denegada = 4 rojas;
    agregar un `<button>Borrar</button>` en el detalle = 4 rojas (solo lectura);
    cambiar el texto del estado vacío = 1 roja.
  - Verificación (frontend/): `npx vitest run` 274 archivos / 4412 pruebas
    verdes; `npm run typecheck`, `npm run lint`, `npm run format:check` limpios.
- Commit T3: `a9cc766`.
- 2026-10-27 T4 hecha: bitácora (`docs/bitacora.md`) escrita; tres revisiones nativas aprobadas. Suites verificadas por tarea (1318 backend, 4412 frontend).
- Siguiente: PRs en cadena.
