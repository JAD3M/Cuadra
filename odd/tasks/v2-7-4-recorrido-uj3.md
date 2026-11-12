# 7.4 · Probar de punta a punta: Pedro controla que el mes sea confiable (UJ-3) (KAN-159)
Objetivo: una prueba que recorra por HTTP el trabajo del revisor y de la auditora sobre un mes conciliado, contra la API, Postgres y Redis reales.
Rama: `feat/v2-7-4-recorrido-uj3`. Entrega: un PR. Runner: `npm test -- <ruta>`.

## Specs
- S1: «una empresa con un mes conciliado» → «la prueba entra como `revisor`» → «su menú muestra solo la bandeja y la bitácora».
- S2: «la bandeja del revisor» → «ve lo que sigue sin resolver, con sus candidatos y su explicación».
- S3: «una confirmación ajena» → «el revisor intenta reabrirla o editarla» → «recibe 403 y queda un acceso denegado».
- S4: «la misma confirmación» → «el revisor deja un comentario» → «el comentario aparece en el detalle y en la bitácora, y el estado no cambia».
- S5: «un `auditor` en la misma empresa» → «consulta la bandeja y la bitácora» → «ve el contenido sin ninguna acción disponible».
- S6 (diferida): «cuando se complete [la épica 9], esta prueba se amplía para cubrir la verificación de la muestra». No se hace en esta historia.

## Supuestos
- A1: la empresa se crea como en 7.2 y 7.3 (dueño → administradora → contadora, revisor y auditora por invitación) y el mes se concilia por HTTP con el juego de `ejemplos/bbva`; los CFDI se re-emiten con el RFC de la empresa en memoria (como en 7.3).
- A2: el «menú» es `capacidades` de `GET /auth/contexto`. Las secciones son los permisos `*.ver`: el revisor tiene solo `bandeja.ver` y `bitacora.ver`.
- A3: «editarla» no tiene endpoint (no hay `PATCH`/`PUT` en el sistema); lo único que cambia una confirmación es reabrirla. S3 se prueba con reabrir, individual y por lote, y se comprueba que la decisión sigue `confirmada`. Se avisa al usuario.
- A4: «lo que sigue sin resolver» son las 3 sugerencias y los 2 sin pareja que quedan tras confirmar la regla 1 (ya no están en la vista por omisión).
- A5: «sin ninguna acción disponible» para la auditora: sus capacidades son solo las dos secciones y cada acción (lote, descartar, comentar, reabrir, cargar) da 403.
- A6: una sola prueba encadenada en `src/e2e/uj3-controlar-el-mes.integracion.spec.ts`; entra en la lista blanca de `arquitectura.spec.ts` por sembrar y limpiar al dueño.

## Tasks
- [x] T1 (hecha; sin RED posible: no hay código nuevo, las rutas ya existen; prueba de control: tres roturas de producción, una a una (reabrir sin comprobar la autoría: 3 pasos; el revisor gana `cargas.ver`: 1; la auditora gana `comentar`: 1), hacen fallar el recorrido y se revirtieron; GREEN: 6 pasos contra Postgres y Redis reales) (S1-S5; inline): el recorrido encadenado.
- [x] T2: notas de cierre (`CUADRA.md`, `docs/bitacora.md`).

## Log
- L1 (2026-11-12): «si. arranca» (historia 7.4 según la lista de historias).
