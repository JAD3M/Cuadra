# Historia 5.5: El dueño desactiva la separación de funciones y la empresa lo ve

Rama: `feat/v2-5-5-desactivar-separacion`
Jira: KAN-148 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 5.5, FR-23, FR-24, FR-67 parte, UX-DR9)
Spine: AD-5, AD-7, AD-13
Mirror Engram: `odd/v2-5-5-desactivar-separacion/tasks`
Runner: backend `npm test -- <spec>`; frontend `npx vitest run <archivo>`
Entrega: `ask-on-risk`; pronóstico ~700 líneas, cadena de 2-3 PR (T1-T2 backend, T3-T4 frontend). Inicio 2026-11-05.

## Specs

- S1: «`separacion_funciones` pasa a `false` solo para esa empresa» y «el motivo es obligatorio y sin
  él se rechaza».
- S2: «queda `desactivar_separacion` en `bitacora_plataforma` y en la bitácora de la empresa, en una
  sola transacción, con quién, cuándo y por qué».
- S3: «una persona de una empresa, incluso `admin`» que intenta cambiarlo «recibe 403 y queda un
  acceso denegado».
- S4: «ve un aviso visible de que opera sin separación de funciones (UX-DR9)» al abrir la bandeja o
  la bitácora.
- S5: al volver a activar, «queda registrado igual, con motivo, y el aviso desaparece».
- S6: «se registra en `tipos.ts`, en su espejo del frontend, en el `CHECK` y en la prueba de deriva».
- Supuesto A1 (a confirmar con el usuario): reactivar usa la MISMA acción `desactivar_separacion`
  ("registrado igual"), con `antes/despues` y `motivo` en `datos`; no se crea una acción nueva.

## Tasks

- [x] T1 (S1-S3, S6 backend + espejo mínimo del frontend, inline, alto riesgo item 2 y 3; commit propio): migración (CHECK de ambas bitácoras +
  `GRANT UPDATE (separacion_funciones)`), `tipos.ts`, endpoint `/plataforma/empresas/:id/separacion-funciones`,
  servicio transaccional, `separacionFunciones` en el listado de empresas. Pruebas.
- [x] T2 (S4 backend): `separacionFunciones` en `GET /auth/contexto`.
- [x] T3 (mockup, aprobado por el usuario 2026-11-05; números 10, 11, 2, 7 y 6): pantalla del dueño (control + motivo) y aviso en bandeja y bitácora. Acordar ANTES del código.
- [x] T4 (S4-S6 frontend, dos escritores en paralelo U1 y U2): espejo, etiquetas/tonos/detalle de bitácora, hook y formulario del dueño, aviso.

## Log

- L1 (2026-11-05): «commitea y arranca con la 5.5».
- Mapa del explorador: nada de 5.5 existe; patrón a copiar `EmpresasPlataforma.crear` (dos bitácoras en
  una transacción con `set_config('app.company_id')`) y `FormularioLevantarVistaPrevia`; el guard ya
  da 403 + `acceso_denegado` (en `bitacora_plataforma`) a sesión de empresa en `/plataforma`;
  `cuadra_app` hoy solo tiene `UPDATE (tolerancia_monto)` en companies; última migración
  `1790713000000-CombinacionesMultiples`.
- T1 hecha: PUT /plataforma/empresas/:id/separacion-funciones {activa, motivo}; migración 1790714000000; 409 si ya estaba en ese estado (supuesto A2, no pedido); el 403 de empresa sale del guard existente (acceso_denegado en bitacora_plataforma, ruta como patrón). Backend 1911 y frontend 4818 verdes. El texto visible de la acción en la bitácora queda para T4 tras el mockup (hoy el filtro muestra el valor de la API). Risk: item 2 (GRANT UPDATE a cuadra_app sobre separacion_funciones) y item 3 (la lista de empresas suma un campo).
- T2 hecha: `empresa.separacionFunciones` en GET /auth/contexto (falla cerrada: solo false explícito avisa). Suite auth verde (147). Risk: item 3 (el contexto suma un campo; contrato aditivo).
- T3 hecha: mockups 10 y 11 (Plataforma: columna, botones, formulario con motivo y estados vía prop `separacion`), 2 y 7 (Bandeja) y 6 (Bitácora) con aviso (prop `separacion`, default `activa`) y la acción «Separación de funciones cambiada». El usuario aprobó los oscuros; los claros siguen los mismos roles de color.
- Ruta T4: dos escritores en paralelo con superficies disjuntas (U1 pantalla del dueño; U2 aviso en bandeja/bitácora + etiquetas de bitácora). Razón: dos unidades independientes de varios archivos cada una.
- T4 hecha: U1 (pantalla del dueño) y U2 (aviso + bitácora). Desvío detectado por U2 y corregido por mí con RED/GREEN: el contexto tiene `staleTime` infinito, el aviso no cambiaba sin recargar; `useSeparacionDesactivada` relee el contexto al abrir la pantalla. Frontend 4862 pruebas, typecheck, lint y prettier verdes. Risk: none (cambios aditivos de UI).
