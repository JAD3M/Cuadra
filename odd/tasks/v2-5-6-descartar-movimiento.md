# Historia 5.6: Descartar un movimiento y deshacer el descarte

Rama: `feat/v2-5-6-descartar-movimiento`
Jira: KAN-149 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 5.6, FR-21, UX-DR9)
Spine: AD-4, AD-7
Mirror Engram: `odd/v2-5-6-descartar-movimiento/tasks`
Runner: backend `npm test -- <spec>`; frontend `npx vitest run <archivo>`
Entrega: `ask-on-risk`; cadena de PR si pasa de ~400 líneas (backend primero, frontend después). Inicio 2026-11-10.

## Specs

- S1: «se crea una decisión `tipo = descarte` en estado `descartada` y el movimiento sale de la bandeja»
  y «el motivo es obligatorio y sin él se rechaza».
- S2: «sus propuestas no se muestran mientras siga descartado».
- S3: «lo deshace quien lo descartó o un `admin`» → «la decisión pasa a `reabierta` y el movimiento
  vuelve a la bandeja como pendiente»; «otra persona sin ese permiso recibe 403».
- S4: «quedan en la bitácora como `descartar` y `deshacer_descarte`, con persona, fecha y motivo».
- S5: «no se puede descartar de nuevo y la respuesta es 409».
- S6: «cada descarte tiene su motivo guardado para poder auditarlo».
- S7: las acciones «se registran en `tipos.ts`, su espejo, el `CHECK` y la prueba de deriva».
- S8: «La pantalla de deshacer necesita mockup antes del código (UX-DR9)».
- Supuesto A1 (a confirmar): para saber «quien lo descartó» se agrega `descartada_por_id` y
  `descartada_at` a `decisiones` (no se reutiliza `confirmada_por_id`).
- Supuesto A2: un descarte usa `origen = manual` y `huella_conjunto` de un arreglo vacío.

## Tasks

- [x] T1 (S1, S3-S7 backend, inline; Risk item 1/3 por migración y CHECK de bitácora): migración
  (columnas del descarte + CHECK de `bitacora` + GRANTs), `tipos.ts`, endpoints descartar y
  deshacer, servicio transaccional con candado y bitácora en la misma sentencia. Pruebas.
- [ ] T2 (S2 backend): caso de un descartado muestra motivo y quién lo descartó, sin propuestas.
- [~] T3 (mockup, S8; publicado, falta aprobación del usuario; números 3, 8 y 6): pantalla de descartar y deshacer. Acordar con el usuario ANTES del código.
- [ ] T4 (frontend): espejo, etiquetas/tonos/detalle de bitácora, acciones en el caso.

## Log

- L1 (2026-11-10): «sí, súbela y arrancamos la 5.6».
- Mapa del explorador: nada de 5.6 existe. Permisos `movimientos.descartar` y
  `movimientos.deshacer_descarte` ya están en la matriz; el segundo es «propio» (el guard solo mira
  rol, el servicio verifica autoría o admin). El índice único `vigente` ya da el 409. Bandeja y caso
  ya ocultan descartados. Patrón a copiar: `ResolucionService.rechazar` (CTE) y la migración
  `1790714000000-DesactivarSeparacion.ts` (CHECK de acciones).
- T1 hecha (inline): migración 1790715000000 (descartada_por_id/descartada_at + CHECK + FK; CHECK de bitácora con descartar y deshacer_descarte), `DescarteService` + `DescarteController` (POST /movimientos/:id/descartar y /deshacer-descarte), tipos.ts. Tamaño: no se delegó (una unidad). Sin RED previo: el código se escribió antes que la prueba (15 casos de integración, verdes). Backend completo 1931 pruebas; se ajustaron dos specs de deriva (retiro-conciliaciones ignora lo posterior al retiro; sugerencias suma el CHECK nuevo). Risk: item 1 (migración añade columnas y CHECK a una tabla existente; aditivo y sin descartes previos).
- T3 publicada (2026-11-10, versión 148 del canvas): mockup 3 y 8 (Detalle oscuro y claro) con vistas nuevas `descartando`, `descarte_sin_motivo`, `descartado`, `descartado_ajeno` (botón «Descartar movimiento» en sin match, formulario con motivo obligatorio, tarjeta «Descartado» con motivo/quién/fecha y «Deshacer descarte» o aviso de permiso); mockup 6 (Bitácora) con «Movimiento descartado» y «Descarte deshecho». Bandeja sin cambios. Pendiente: aprobación del usuario antes del código del frontend.
- T2 pendiente: `GET /casos/:id` devuelve `descarte { motivo, por, fecha, puedeDeshacer }` (puedeDeshacer calculado en el servidor: admin o quien descartó, y rol con permiso).
