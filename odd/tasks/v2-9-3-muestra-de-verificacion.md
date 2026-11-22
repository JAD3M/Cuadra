# 9.3 · Generar la muestra de verificación del mes (KAN sin verificar en Jira)
Objetivo: que Cuadra elija cada mes, al azar, un grupo de confirmaciones en lote de la regla 1 para que un revisor las verifique (9.4), y que el sorteo se guarde y no se repita.
Rama: `feat/v2-9-3-muestra-de-verificacion`. Entrega: un PR (backend; sin pantalla). Pruebas: `npm test` (backend; no `npx jest`).

## Specs
- S1: «elige al azar el 5% de las propuestas de la regla 1 confirmadas en lote ese mes, con un mínimo de 20 casos, o todas si hay menos» [SUPUESTO].
- S2: «se inserta en `muestras_verificacion` con la empresa, el mes y las decisiones elegidas» y «no se vuelve a sortear: ejecutar la generación otra vez para el mismo mes devuelve la misma muestra».
- S3: «una empresa sin confirmaciones en lote ese mes» → «no crea muestra y registra que no había con qué».
- S4: «es un trabajo en segundo plano, idempotente por empresa y mes, que toma el candado de empresa».
- S5: «`cuadra_app` solo puede hacer `SELECT` e `INSERT`, con `company_id` y RLS (clase 1)». Toda tabla de dominio nueva: `company_id`, RLS con FORCE, política y GRANTs en la misma migración.

## Supuestos
- A1 (acordado con el usuario, 2026-11-17): la tabla es de solo agregar. La 9.3 guarda solo lo sorteado (`company_id`, mes, `decision_id`); en la 9.4 cada marca (verificador, resultado, fecha) se agrega como fila nueva en la misma tabla y el estado de un caso es su última marca. Sin `UPDATE`.
- A2: «confirmada en lote» = fila de `decisiones` con `lote_id IS NOT NULL`, `estado = 'confirmada'`, `regla = 'referencia_monto_exacto'` y `confirmada_at` dentro del mes. Una decisión reabierta ya no está `confirmada` y no entra (un falso positivo es peor que no conciliar).
- A3: el mes es el mes calendario en UTC (el repo no usa zona horaria en ningún otro lugar).
- A4: el 5% se redondea hacia arriba; el tamaño es `min(N, max(20, ceil(0.05 * N)))`.
- A5: el sorteo es `ORDER BY random()` dentro de una sola sentencia con el candado de empresa tomado; la garantía de «no se re-sortea» es que la muestra se guarda y una segunda corrida devuelve las filas existentes, con un índice único `(company_id, mes, decision_id)` como red. La 9.4 lo ajustará a parcial cuando agregue las filas de marca.
- A6: «registra que no había con qué» = un `Logger.log` del servicio y el resultado `sin_casos`; no hay tabla de corridas ni acción de bitácora nueva.
- A7: el disparo mensual (cron o cierre de mes) no existe en el repo: la 9.3 entrega el trabajo (cola, procesador, `encolar(empresa, mes)`), no su programación. RESUELTO el 2026-11-22 (L4): programador repetible de BullMQ.
- A8: el número KAN de la 9.3 es KAN-168 (verificado el 2026-11-22 y pasado a Finalizado).

## Tasks
- [x] T1 (S2,S5; inline): migración `muestras_verificacion` (company_id, RLS FORCE, política, GRANT SELECT/INSERT) y entidad.
- [x] T2 (S1,S2,S3,S4; inline): servicio de generación (candado de empresa, sorteo, idempotencia, sin casos) con pruebas de integración.
- [x] T3 (S4; inline): cola `muestras`, procesador con `jobId` por empresa y mes, registro en `SombraModule`.
- [x] T4: notas de cierre (`CUADRA.md`, `docs/bitacora.md`) y PR (#151, integrado).
- [x] T5 (A7; inline): `ProgramadorMuestras` (programador repetible `0 5 1 * *` UTC, encola a las empresas activas para el mes anterior) y despacho por nombre en `ProcesadorMuestras`.

## Log
- L1 (2026-11-17): «sí, intégralo y sigue con la historia que sigue» (siguiente historia según la lista: 9.3).
- L2 (2026-11-17): el usuario eligió: «con tu recomendación, solo agregar» (A1).
- L3 (2026-11-17): T1-T3 inline (una sola unidad, sin razón de escritor). RED: el spec no cargaba (`muestras.service` inexistente); GREEN: 11 de 11 en `muestra-verificacion.integracion.spec.ts` (incluye la cola real y dos corridas a la vez). Suite completa: 122 archivos; fallaron 2 specs viejas por la tabla nueva (`TRUNCATE` de `tolerancia.integracion.spec.ts` y la lista de migraciones posteriores de `retiro-conciliaciones.migracion.spec.ts`), ya corregidas y en verde; `down-con-datos.migracion.spec.ts` se actualizó con un `undo` más. `eslint` y `prettier` limpios; el build con solo `src` copiado a un directorio limpio compila. Risk: item 1 (migración y tabla nueva de solo agregar; sin datos existentes que cambiar, el `down` solo borra la tabla nueva) y item 2 (RLS/GRANTs de tabla de dominio nueva).
- L4 (2026-11-22): «sigamos tu recomendacion de un job repetible de BullMQ que encole a todas las empresas el dia 1 para el mes anterior». T5 inline. RED: el spec no cargaba (`programador-muestras` inexistente); GREEN: 7 pruebas nuevas. Suite completa: 123 archivos, 2215 pruebas en verde. Una prueba salió inestable (1 de 3 corridas): mismo `jobId` que la prueba anterior mientras el worker en línea aún lo procesaba; se corrigió con mes propio y cola en pausa, 12 corridas seguidas sin fallos. `eslint`, `prettier` y `tsc` limpios. Risk: none (agrega un provider que solo se registra donde se consumen las colas; `ProcesadorMuestras` conserva su camino para los trabajos por empresa).
