# v2 · Historia 3.1 — Cargar CFDI y CSV sin duplicar nada

Ramas en cadena (una por tarea, cada una sobre la anterior):
`feat/v2-3-1-01-api-cargas` → `feat/v2-3-1-02-frontend-contrato-hook` →
`feat/v2-3-1-03-frontend-pantalla`.
Cubre: FR-4, FR-5, FR-6, FR-9, FR-52 (parte). Arquitectura: AD-9, AD-16.
Jira: KAN-130 (ver `_bmad-output/planning-artifacts/jira-mapping.md`).
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 3.1). Ratifica CU-08 y
CU-09 de la v1 y agrega la marca de moneda. Base: la 2.7
(`odd/tasks/v2-2-7-consultar-bitacora.md`).

## Objetivo

El `admin` o el `contador` sube CFDI en XML o un estado de cuenta en CSV, ve
cuántos registros entraron y la carga queda en la bitácora como `cargar` con
persona, fecha, archivo y resultado. Un archivo repetido responde «ya existía»
sin crear nada. Un CFDI en moneda distinta de MXN se acepta pero queda marcado
«moneda no soportada». Un estado de cuenta que no está en MXN se rechaza con el
motivo. `revisor` y `auditor` reciben 403 y no ven Cargas en su menú.

## Estado actual (exploración, 2026-10-27)

- Casi todo existe de la v1 (CU-06 a CU-09): `POST /cargas/cfdi` y
  `POST /cargas/estado-cuenta` (`src/cargas/cargas.controller.ts`), duplicados
  por hash (índice único por empresa), rechazos de archivo y de fila
  (`con_errores`), permisos `cargas.cargar` y `cargas.ver` solo para
  admin/contador, y la pantalla completa en `frontend/src/features/cargas`.
- **Falta 1 (FR-52):** nadie escribe la entrada `cargar` en la bitácora. La
  acción ya existe en `ACCIONES_BITACORA` y en el CHECK.
- **Falta 2:** `src/cfdi/lector-cfdi.ts:50-58` acepta MXN, USD, EUR, CAD, GBP,
  JPY y XXX sin marca y rechaza el resto (`moneda_no_soportada`). El criterio
  pide lo contrario: aceptar y marcar.
- **Falta 3:** el CSV canónico no trae moneda; no existe el rechazo de un estado
  de cuenta que no está en MXN.
- **Falta 4:** el frontend no menciona la moneda; `AvisoRevisor` sigue activo
  aunque revisor y auditor ya no deberían llegar a la pantalla.
- Mockup de Cargas con la marca, el rechazo por moneda y «Con filas
  rechazadas»: aprobado el 2026-10-27 (canvas versión 82).

## Alcance

- Backend: entrada `cargar` en la bitácora; marca de moneda del CFDI; columna
  opcional `moneda` en el CSV canónico con rechazo si no es MXN.
- Contrato, hooks y espejo; pantalla según el mockup aprobado; prueba de flujo
  por rol del menú.

## Fuera de alcance

- PDF de BBVA (3.2 en adelante), conciliar CFDI en otras monedas (épica 4),
  conversión de monedas, vista previa e historial nuevo (3.4, 3.7).

## Decisiones tomadas

- **La marca se deriva de la columna `moneda`** (acordado el 2026-10-27): se
  marca todo CFDI cuya moneda no sea MXN ni XXX (XXX = «sin moneda», CFDI de
  pago). Sin migración ni columna nueva. El lector deja de rechazar monedas por
  lista y acepta cualquier código de moneda bien formado (3 letras mayúsculas).
- **La carga sigue `procesada`** aunque tenga archivos marcados; la marca va por
  archivo en `resultados` (código de moneda) y el historial muestra cuántos hay.
- **Estado de cuenta:** columna opcional `moneda` en el CSV canónico (acordado el
  2026-10-27). Si existe y alguna fila no dice MXN, se rechaza el archivo
  completo con el motivo; si no existe, se asume MXN y los perfiles de banco
  actuales no cambian.
- **Bitácora `cargar`:** la escribe el worker al terminar la carga, con persona,
  fecha, archivo y resultado (estado y conteos). Un archivo repetido (`yaExistia`)
  no crea carga y por tanto no escribe entrada.
- **Etiqueta «Con filas rechazadas»** reemplaza «Con errores» para el estado
  `con_errores` en la interfaz (palabras del criterio).

## Tareas

- [x] **T1 — Backend.** RED primero: entrada `cargar` por carga terminada
  (procesada, con_errores, fallida) con persona/archivo/resultado y aislada por
  empresa; sin entrada en `yaExistia`; CFDI en USD/EUR/otra moneda aceptado con
  marca en `resultados`; XXX y MXN sin marca; CSV con columna `moneda` ≠ MXN
  rechazado completo con motivo; sin columna = MXN. Ajusta las pruebas del
  lector que esperaban el rechazo por lista.
- [ ] **T2 — Contrato, hooks y espejo.** `resultados` con la marca de moneda y el
  motivo de rechazo en el contrato, deriva con el backend, textos y etiqueta
  «Con filas rechazadas».
- [ ] **T3 — Pantalla.** Marca por archivo, leyenda, nota en el historial,
  estado de rechazo por moneda, `AvisoRevisor` retirado o justificado, prueba de
  flujo por rol (menú sin Cargas para revisor y auditor).
- [ ] **T4 — Cierre.** Suites completas, lint y `format:check`, bitácora, KAN-130,
  PRs en cadena. Revisión nativa única de la rama completa contra `master`,
  siguiendo el `START` que da la herramienta (con consentimiento).

## Aceptación

Los siete criterios de la Story 3.1 en `epics.md`.

## Rutas y evidencia

| Tarea | Ruta | Evidencia del disparador |
|---|---|---|
| Exploración | delegada (explorador) | >5 búsquedas en backend y frontend |
| Mockup | delegada (escritor del canvas) | leer y editar un archivo grande |
| T1–T3 | escritor delegado, una tarea a la vez | 2+ archivos no triviales por tarea |

## Progreso

- 2026-10-27: decisiones de producto tomadas (marca derivada, columna opcional
  `moneda`); mockup aprobado; exploración hecha; documento creado.
- Espejo en Engram (`odd/v2-3-1-cargar-cfdi-y-csv/tasks`): pendiente; `mem_save`
  falló dos veces con «Claude host session registration could not be confirmed».
  Se reintenta más adelante.
- 2026-10-27 T1 hecha (escritor delegado, ruta delegada). RED observado antes
  de implementar: lector CFDI 10 pruebas en rojo (`EUR/CHF/JPY/CAD` rechazadas,
  moneda mal formada con motivo `moneda_no_soportada`, `esMonedaNoSoportada`
  inexistente); lector de estado de cuenta 10 en rojo (`posicionMoneda`,
  `MENSAJE_MONEDA_NO_MXN`); integración de cargas 10 en rojo (marcas y entrada
  `cargar` ausentes). Las pruebas de integración del CSV con `moneda` se
  escribieron junto con la implementación (sin RED propio).
  Decisiones de T1: la entrada `cargar` la inserta `registrarCargar`
  (`src/cargas/registrar-carga.ts`) en la misma transacción que deja la carga
  en su estado final (también `fallida`), solo si esa transacción fue la que la
  terminó; `entidad` = `cargas`, agregada a `ENTIDADES_BITACORA` (sin CHECK en
  base, sin migración); `user_id` = `cargas.subido_por_id`. La marca va en
  `resultados` como `{moneda, monedaNoSoportada: true}` (también en
  `ya_existia`). Monedas con 0 y 3 decimales conocidas; el resto, 2. El CSV:
  `columnaMoneda` opcional en el perfil `cuadra` (cualquier posición); rechazo
  400 `{statusCode, message, error: 'moneda_no_mxn'}`.
  Verificación: `npm test -- --runInBand` 62 suites, 1357 pruebas, 0 fallas;
  `npm run typecheck`, `npm run lint` (sin cambios extra), `prettier --check
  "src/**/*.ts"` y `npm run build` limpios. Roles: revisor 403 ya cubierto en
  ambos endpoints; auditor por la matriz (`matriz.spec.ts`).
  Pendiente para T2: espejo frontend de `ENTIDADES_BITACORA` (agregar `cargas`).
- Commit de T1: ver abajo.
- Siguiente: T2.
