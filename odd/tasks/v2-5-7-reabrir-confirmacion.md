# Historia 5.7: Reabrir una confirmación y volver a confirmar

Rama: `feat/v2-5-7-backend` (cadena: backend, caso, frontend)
Jira: KAN-150 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 5.7, FR-26 a FR-30)
Spine: AD-4, AD-7, AD-19
Mirror Engram: `odd/v2-5-7-reabrir-confirmacion/tasks`
Runner: backend `npm test -- <spec>` (Docker arriba); frontend `npx vitest run <archivo>`
Entrega: `ask-on-risk`; cadena de PR. El espejo de la acción `reabrir` en el frontend va en el MISMO PR que el cambio de `tipos.ts`. Inicio 2026-11-10.

## Specs

- S1: «una decisión `confirmada`» que reabre «un `admin` o quien la confirmó, indicando un motivo»
  «pasa a `reabierta`, la factura y el movimiento vuelven a estar abiertos y el caso regresa a la
  bandeja como pendiente» y «el motivo es obligatorio».
- S2: «la confirmación original» reabierta «queda en el historial del caso y se puede consultar».
- S3: «una persona con rol `revisor` o `auditor`» que intenta reabrir una confirmación ajena
  «recibe 403 y queda un acceso denegado (el revisor solo puede reabrir lo que él confirmó)».
- S4: «un caso reabierto» cuando «el motor corre de nuevo» «puede generar propuestas nuevas, y la
  reconfirmación crea una decisión nueva que sigue las mismas reglas, incluida la separación de
  funciones».
- S5: «queda en la bitácora como `reabrir`, con persona, fecha y motivo».
- S6: «dos personas que reabren la misma confirmación a la vez» → «una gana y la otra recibe 409».
- S7: «La acción `reabrir` se registra en `tipos.ts`, su espejo, el `CHECK` y la prueba de deriva».
- Supuesto A1: reabre un admin o quien la confirmó (mismo criterio que deshacer un descarte, 5.6);
  el contador no reabre confirmaciones ajenas. Otro rol con el permiso recibe 403.
- Supuesto A2: un CFDI `cancelada` (confirmación en «Requiere revisión») se queda `cancelada`; solo
  vuelven a `abierta` los CFDI que estaban `conciliada`. La decisión pasa a `reabierta` y
  `requiere_revision` se limpia.
- Supuesto A3: el motivo de la reapertura vive en la bitácora (`datos.motivo`); `decisiones.motivo`
  conserva el de la confirmación. Las hermanas `obsoleta` no se restauran: el motor regenera.

## Tasks

- [x] T1 (S1, S3-S7 backend + espejo mínimo del frontend, inline; Risk item 1 y 4: CHECK de bitácora, transición con candado): migración (CHECK con `reabrir`), `tipos.ts`, `POST /conciliaciones/:id/reabrir {motivo}`, servicio transaccional (orden AD-19), espejo del frontend (tipos, acciones, etiquetas, tonos, detalle y pruebas). Pruebas incluida la concurrencia.
- [x] T2 (S2, backend): el caso trae `puedeReabrir` y el historial alcanza la confirmación reabierta.
- [~] T3 (mockup, publicado el 2026-11-10 en el canvas v150, falta aprobación; números 3, 8 y 6): botón «Reabrir confirmación» con motivo en el detalle (mockups 3 y 8) y la acción en la bitácora (6). Acordar con el usuario ANTES del código.
- [ ] T4 (frontend, S1-S2): formulario de reapertura, hook, contrato, historial.

## Log

- L1 (2026-11-10): «sí, integra el 115 y arranca la 5.7».
- Mapa del explorador: no existe `reabrir` en servicio ni endpoint; el permiso `conciliaciones.reabrir`
  ya está en la matriz (admin, contador, revisor) y en `PERMISOS_PROPIOS`; `reabierta` ya es un estado
  válido y `vigente` se libera solo; `decision_lineas` sigue por FK; `conciliar()` ignora las
  `reabierta` y puede volver a proponer el mismo conjunto. Patrón a copiar: `DescarteService` (5.6) con
  el orden AD-19 (decisión, CFDI, movimiento), que `deshacer` no seguía. Última migración
  `1790715000000-DescartarMovimiento`. No hay mockup de reabrir.
- T1 hecha (inline, una unidad): migración 1790716000000 (CHECK con `reabrir`), `ReabrirService`/`ReabrirController` (POST /conciliaciones/:id/reabrir {motivo}; orden AD-19; 404, luego 403, luego 409; CFDI cancelado se queda cancelado), `tipos.ts` y espejo del frontend (tipos, acciones, etiquetas «Confirmación reabierta», tono, detalle y pruebas). 13 pruebas de integración nuevas (incluye dos reaperturas a la vez: 200 y 409; motor que vuelve a proponer y reconfirmación). Sin RED previo: el código se escribió antes que la prueba. Backend 1948 y frontend 4918 verdes, lint y prettier limpios. Risk: item 4 (transición concurrente bajo candado) y item 1 (CHECK de bitácora reescrito).
- T2 hecha: `GET /casos/:id` suma `puedeReabrir` (conciliado, rol con permiso y admin o quien confirmó; el servidor decide) y `GET /conciliaciones/:id/historial` incluye los eventos de las confirmaciones `reabierta` del mismo movimiento, así la propuesta nueva muestra confirmar y reabrir. 4 pruebas nuevas; backend 1952 verdes. Risk: item 3 (campo aditivo en el caso; el historial solo suma eventos donde hay una reapertura).
- T3 publicada: mockup 3 y 8 (Detalle oscuro y claro) con botón «Reabrir confirmación» en el caso conciliado y en «Requiere revisión», formulario con motivo obligatorio, aviso de permiso y el historial con «Confirmada» y «Reabierta» en la propuesta nueva; vistas `reabriendo`, `reabrir_sin_motivo`, `conciliado_ajeno`, `reabierto`. Mockup 6 (Bitácora) con «Confirmación reabierta». Pendiente la aprobación del usuario.
