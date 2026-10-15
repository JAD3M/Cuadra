# v2 · Historia 2.2 — Cada rol ve solo su menú y sus botones

Rama: `feat/v2-2-2-menu-y-botones-por-rol` (desde `master` tras la 2.1).
Cubre: FR-25, FR-53, FR-54. Arquitectura: AD-11, AD-12.
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 2.2).
Mockups aprobados el 15 oct 2026 (canvas de Claude Design, versión 65):
rol `auditor`, menú filtrado, Detalle sin acciones para el auditor, Cargas y
Tolerancia con «No tienes permiso» para revisor y auditor.

## Objetivo

El servidor entrega las capacidades de la persona en `GET /auth/contexto`,
derivadas de la matriz; el frontend construye menú y botones solo con esa
lista, sin ningún literal de rol en las pantallas.

## Estado actual (exploración)

- `GET /auth/contexto` (`src/auth/auth.controller.ts:75-100`) devuelve
  `{usuario, empresa, roles}`; sin capacidades. DTO en
  `src/auth/dto/respuestas.dto.ts:55-70`; contrato zod en
  `frontend/src/shared/api/contratos/auth.ts:40-44`.
- Frontend: `ROLES_QUE_CARGAN` (`shared/dominio/cargas.ts:40`) y
  `ROLES_QUE_EDITAN_TOLERANCIA` (`shared/dominio/tolerancia.ts:18`), usados en
  `features/cargas/vista.ts:52` y `features/tolerancia/vista.ts:25`.
- `ELEMENTOS_NAV` fijo (`app/shell/navegacion.ts:19-48`); `Sidebar.tsx:50-57`
  no filtra.
- `PanelDecision` del detalle del caso (`features/caso/CasoContenedor.tsx:191-226`)
  no controla por rol.
- `shared/dominio/permisos.ts` (2.1) ya espeja la matriz; nadie lo usa aún.
- Pruebas modelo: `frontend/tests/dominio/*SinLiterales.test.ts`.

## Alcance

- Backend: `capacidades: Permiso[]` en `/auth/contexto`, unión de los roles de
  la persona sobre la matriz (sin permisos del dueño).
- Frontend: contrato con `capacidades`, utilidad `puede(capacidades, permiso)`,
  menú filtrado por capacidad, `PanelDecision` condicionado a
  `conciliaciones.resolver` con la nota de solo lectura del mockup, Cargas y
  Tolerancia con `cargas.cargar` y `tolerancia.editar`.
- Desaparecen `ROLES_QUE_CARGAN` y `ROLES_QUE_EDITAN_TOLERANCIA`.
- Prueba que impide literales de rol en `app/shell` y `features/**`.
- Descripciones de rol en `respuestas.dto.ts` incluyen `auditor`.

## Fuera de alcance

- Pantalla y menú de Usuarios (historia 2.5), invitar a la empresa (2.3).
- Guardas de ruta con redirección: el acceso directo conserva el estado
  «No tienes permiso» que ya existe por el 403.
- Corregir la prueba intermitente `CRL-3` (PR aparte).

## Decisiones tomadas

- Las capacidades son los permisos de la matriz que tiene alguno de los roles
  de la persona; las marcas `propio` entran igual que en el guard.
- El servidor sigue siendo la autoridad: ocultar es comodidad, el 403 manda.
- Las etiquetas de rol del pie del menú siguen viniendo de `ETIQUETAS_ROL`.

## Delivery

Estrategia de cadena: `stacked-to-main`, una rebanada por tarea (la misma que
eligió el usuario en la 2.1).

## Tareas

- [x] **T1** Backend: `capacidades` en `/auth/contexto` (DTO, servicio, pruebas) y descripciones de rol con `auditor`. (ruta: delegada, escritor único)
- [x] **T2** Frontend: contrato `capacidades`, `puede`/hook, reemplazar `ROLES_QUE_*` en cargas y tolerancia. (ruta: delegada, escritor único)
- [x] **T3** Menú filtrado por capacidad (`ELEMENTOS_NAV` con permiso, `Sidebar`) y pruebas por rol. (ruta: delegada, escritor único)
- [x] **T4** Detalle sin acciones para el auditor (nota de solo lectura), prueba «sin literales de rol» en shell y features. (ruta: delegada, escritor único)
- [ ] **T5** Cierre: pruebas completas, bitácora, PR en cadena.

## Criterios de aceptación

Los de la historia en `epics.md`: capacidades desde el servidor; cada rol ve
exactamente las secciones de FR-53; el auditor ve contenido sin botones de
acción; sin literales de rol en pantallas y `ROLES_QUE_*` eliminados; varios
roles → unión; menú filtrado y con tema claro y oscuro.

## Verificación

- Backend: `npm test` (jest vía script, con `--experimental-vm-modules`).
- Frontend: `cd frontend && npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`.
- `docs/bitacora.md` no se pasa por prettier (ya viene sin formato).

## Progreso

T1-T4 hechas y comprobadas; falta T5 (cierre: bitácora, estado en CUADRA.md, PR en cadena).

| Tarea | Commit |
|-------|--------|
| T1 | `43355fa` feat(permisos): capacidades de la persona en /auth/contexto |
| T2 | `af0ca06` feat(frontend): capacidades de la sesión sustituyen a ROLES_QUE_* |
| T3 | `fb6bc17` feat(frontend): menú filtrado por capacidades del servidor |
| T4 | `d65f7c4` feat(frontend): detalle sin acciones para quien no puede resolver |

Decisiones: sin rutas con redirección (fuera de alcance). La prueba
`frontend/tests/dominio/rolesSinLiterales.test.ts` exceptúa solo datos de
ejemplo de la galería (`features/kit/**`, `app/MuestraShell.tsx`). Los flujos
de cargas y tolerancia que llegaban a la pantalla con el enlace del menú como
revisor de B ahora navegan por ruta directa, porque ese rol ya no ve el enlace.

## Evidencia

- T1 RED: `Tests: 14 failed, 90 passed` (permisosDeRoles is not defined);
  GREEN: `npm test -- src/auth` 141 passed.
- T2 RED: 9 failed, 577 passed (puede no existe; contrato sin capacidades).
- T3/T4 RED: 7 failed (elementosVisibles, permiso por elemento, Sidebar, nota
  del detalle); GREEN al implementar.
- Final: backend `npm test` 58 suites / 1206 passed; `npm run lint` y
  `npm run build` limpios; prettier de `src` y `scripts` limpio (el patrón
  `test/**/*.ts` no encuentra archivos). Frontend: `npm test` 262 archivos /
  4182 passed; lint, format:check y typecheck limpios.
