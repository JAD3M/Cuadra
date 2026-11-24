# 9.4 · Verificar la muestra, caso por caso (KAN-169)
Objetivo: que un revisor abra la muestra del mes y marque cada caso como conforme o en desacuerdo, con persona y fecha, sin reabrir nada por sí solo.
Rama: `feat/v2-9-4-verificar-la-muestra`. Entrega: PR en cadena si pasa de 400 líneas (backend, luego frontend). Pruebas: `npm test` (backend; no `npx jest`) y la suite del frontend.

## Specs
- S1: «ve cada caso con su factura, su movimiento y la regla, y los marca uno por uno como conforme o en desacuerdo».
- S2: «Given una empresa sin ninguna persona con rol `revisor` / Then la verifica el `admin`».
- S3: «no la hace quien confirmó ese lote» cuando «existe otra persona además de quien confirmó el lote» [SUPUESTO].
- S4: «queda con persona y fecha en `muestras_verificacion` y en la bitácora como `verificar_muestra`».
- S5: «no reabre nada por sí solo; la persona que lo decide usa la reapertura de la historia 5.7».
- S6: «una persona con rol `auditor`» «puede verla pero no marcarla».
- S7: «se amplía para cubrir la verificación de la muestra» (la prueba de extremo a extremo de Pedro, historia 7.4).
- S8: «la acción `verificar_muestra` es nueva» → «se registra en `tipos.ts`, en su espejo, en el `CHECK` y en la prueba de deriva».
- S9: pantalla según los mockups 22 · Muestra de verificación (oscuro) y 23 · Muestra de verificación (tema claro), aprobados por el usuario el 2026-11-22.

## Supuestos (mockup aprobado)
- A1: sin asignación; cualquier persona elegible marca.
- A2: quien confirmó el lote ve sus casos bloqueados (S3).
- A3: «Cambiar marca» permitido; cada marca es fila nueva y vale la última (tabla de solo agregar, 9.3 A1). El índice único pasa a parcial (solo filas del sorteo).
- A4: «En desacuerdo» solo enlaza al detalle del caso para reabrir (5.7).
- A5: ítem de menú «Muestra» para revisor, admin y auditor. Hace falta el permiso de sección `muestra.ver` (`admin`, `revisor`, `auditor`); `muestra.verificar` ya existe (`admin`, `revisor`).
- A6: el `admin` verifica solo si la empresa no tiene ningún `revisor` (comentario de `matriz.ts`).
- A7: la lectura de la muestra devuelve por caso un resumen con JOIN (decisión, movimiento, CFDI), sin reusar `CasosService.obtener` (es por movimiento).
- A8: un caso cuya decisión ya no está `confirmada` (reabierta) se muestra como `reabierta` y no se marca (409 si se intenta). Supuesto mío, no pedido por la historia: un falso positivo es peor que no conciliar.
- A9: elegibles = revisores activos de la empresa y, solo si no hay ninguno, admins activos. Quien confirmó el lote queda fuera solo si hay otra persona elegible. Una sola función (`puedeMarcar`) alimenta el botón (`puedeMarcar` del GET) y el POST.
- A10: el 403 del POST por regla de negocio deja `acceso_denegado` en la bitácora y va antes del 409.

## Tasks
- [x] T1 (S4,S8; inline): migración `1790724000000` (columnas de marca, índice parcial, CHECK de `verificar_muestra`), entidad, `tipos.ts`, espejo y deriva.
- [x] T2 (S2,S3,S4,S5,S6; inline): servicio y controller (`GET` muestra, `POST` marca) con candado, bitácora en la misma sentencia y permiso `muestra.ver`.
- [x] T3 (S1,S6,S9; delegado por el respaldo de contexto): frontend: contrato, hook, pantalla, ruta, menú, tema claro/oscuro.
- [x] T4 (S7; inline): ampliar la E2E de Pedro (`uj3-controlar-el-mes.integracion.spec.ts`).
- [ ] T5: notas de cierre (`CUADRA.md`, `docs/bitacora.md`), Jira KAN-169 y repaso.

## Log
- L1 (2026-11-22): «continuemos donde lo dejamos» → «lo apruebo» (los mockups 22 y 23 y sus cinco supuestos).
- L2 (2026-11-22): mapa del explorador: acción de referencia `comentar` (commit `1f4859e`, migración `1790718000000`); la lista `ACCIONES_ANTES` del CHECK debe copiarse de la última migración que tocó `ck_bitacora_accion`; AD-7 menciona `levantar_vista_previa`, que no está en `ACCIONES_BITACORA` (no afecta a la 9.4).
- L3 (2026-11-22): T1 inline, commit `ef1796d`. RED: 3 de 5 fallaban en `marcas-verificacion.integracion.spec.ts`; GREEN: 180/180 en `src/sombra` y `src/database`, 525/525 en frontend. Hallazgo: mi primer CHECK dejaba pasar `resultado` nulo con `verificador_id` (NULL en la rama OR); lo detectó la prueba y se corrigió con `resultado IS NOT NULL AND`.
- L4 (2026-11-22): T2 inline. RED: 13 de 13 en `verificacion-muestra.integracion.spec.ts` (404, la ruta no existía); GREEN: 13/13 y suite completa 2233 (las dos pruebas de la E2E de Pedro y de `/auth/contexto` que fijaban las capacidades del revisor y del auditor se actualizaron por `muestra.ver`). Endpoints: `GET /muestra?mes=AAAA-MM`, `POST /muestra/casos/:decisionId/verificar`.
- L5 (2026-11-22): T2 commit `b07bde1`. Risk: item 2 (permiso `muestra.ver` y regla de quién verifica). Evaluación nativa `high_risk`; el usuario eligió «Review this change»; lentes riesgo y fiabilidad: aprobada, autoridad consumida. Advertencia no bloqueante R3-001 (`verificacion-muestra.service.ts:120`): un caso reabierto cuenta como `pendiente` en `avance` y nadie puede resolverlo; pendiente de decidir en T3 con el mockup (no reabrir la revisión).
- L6 (2026-11-22): T3. Backend ampliado antes (motivo, marcas, `sinRevisor`, `puedeVerificar`, `reabiertas`, `confirmadaPorMi`; resuelve R3-001): RED 4 de 14, GREEN 14/14. Frontend por un escritor delegado (razón: respaldo de contexto del padre): `features/muestra/`, contrato, ruta `/muestra`, menú, pruebas de flujo. Spot check del padre: suite completa 326 archivos / 5184 pruebas, typecheck, eslint y prettier limpios. Arreglo del padre: `bitacoraAdministracion.test.tsx` (lista del filtro de acciones, rota por la T1) y `confirmadaPorMi` del servidor en lugar de comparar nombres. Sin verificación visual (no hay navegador). Desvíos del mockup a acordar: caso reabierto (sin botones, una línea de texto), tarjeta CFDI sin fecha (la API no la da), moneda distinta de MXN con su código, botones deshabilitados sin texto para quien no es elegible. Risk: none.
- L7 (2026-11-22): T4 inline. Nuevo paso en `uj3-controlar-el-mes.integracion.spec.ts` (sorteo, Pedro marca desacuerdo y luego conforme, bitácora, la administradora ya no marca, la auditora solo ve, la contadora no ve): 7/7 en verde. No hubo RED: la función ya existía y el paso solo la recorre de punta a punta. Risk: none.
