# 8.3 · Los tres bancos cumplen el mismo contrato (KAN-165)
Objetivo: que BBVA, Banorte y Santander pasen por el mismo cuadre y rechazo, que exista una carga «sin cuadre automático», que la pantalla tome la lista de bancos del backend y que los tres concilien un mes en la prueba de punta a punta.
Rama: `feat/v2-8-3-contrato-de-bancos`. Entrega: cadena de PR (backend, frontend). Pruebas: `npm test` (backend; no `npx jest`) y vitest (frontend).

## Specs
- S1: «verifica que cada uno devuelve la misma forma de datos y que todos usan la misma función de cuadre».
- S2: «un PDF con saldos que no cuadran para cada banco» → «los tres rechazan la carga completa con el mismo tipo de mensaje y sin dejar nada a medias».
- S3: «un banco cuyo PDF no trae saldo inicial y final» → «el lector marca la carga como "sin cuadre automático" y exige la vista previa de una persona, en vez de saltarse la comprobación» [SUPUESTO: se confirma con los PDF reales].
- S4: «la lista de bancos en la pantalla de cargas» → «ve BBVA, Banorte y Santander, tomados del backend (UX-DR4)».
- S5: «se cumple cuando los tres bancos cargan, cuadran y concilian un mes de ejemplo en la prueba de punta a punta de la épica 7».

## Supuestos
- A1: S3 se implementa en el contrato y en el servicio: `EstadoCuentaLeido.saldoInicial/saldoFinal` pasan a `string | null`; con ambos en `null` se omite el cuadre, la carga queda `pendiente_vista_previa` aunque la vista previa del banco esté levantada, y la respuesta lleva `cuadreAutomatico: false`. Con solo uno de los dos saldos se sigue rechazando. Los tres lectores actuales siguen exigiendo los saldos: sin saldo inicial no se deduce el signo del primer movimiento. El camino se prueba con un lector de prueba.
- A2: una carga sin saldos aceptada por una persona no cuenta para `cargas_aceptadas_por_banco()` (usa `saldo_inicial IS NOT NULL`); se documenta, no se cambia.
- A3: S4: `GET /auth/contexto` suma `bancosPdf: [{id, nombre}]` (campo nuevo, no rompe a nadie); el registro de lectores guarda el nombre. La pantalla deja de espejar la lista a mano. Mismo `<select>` del mockup 4: sin cambio de diseño.
- A4: S5: un helper de pruebas arma el texto/PDF de cada banco con su layout; el mes de ejemplo es el de `scripts/ejemplos/juego.ts`. Los PDF de Banorte y Santander siguen siendo sintéticos [SUPUESTO].
- A5: sin migración.

## Tasks
- [x] T1 (S1,S2; inline): helper de PDFs por banco, prueba de contrato sobre `BANCOS_PDF` y HTTP de saldos que no cuadran en los tres.
- [x] T2 (S3; inline): saldos `null`, servicio sin cuadre automático, sin auto-aceptar, `cuadreAutomatico` en la respuesta.
- [x] T3 (S4; inline): `GET /bancos/pdf` (junto a `GET /bancos/perfiles`, no en `/auth/contexto`: `auth` no debe depender de `bancos`) y la pantalla lo usa con `useBancosPdf`. Mockup 4 actualizado antes.
- [x] T4 (S5; inline): prueba de punta a punta con los tres bancos.
- [x] T5: notas de cierre (`CUADRA.md`, `docs/bitacora.md`).

## Log
- L1 (2026-11-12): «si seguimos con esa» (historia 8.3 según la lista de historias).
- L2 (2026-11-12): decisión: la lista va en `GET /bancos/pdf` y no en `GET /auth/contexto`, para que `auth` no dependa de `bancos`; sigue el precedente de `GET /bancos/perfiles`. El usuario aprobó actualizar el mockup 4 con tres estados nuevos (bancos cargando, error al cargar bancos y PDF sin cuadre automático).
- L3 (2026-11-12): backend: 119 suites, 2181 pruebas (2 specs viejos ajustados por el campo nuevo `cuadreAutomatico`). T1 y T4 fijan comportamiento existente (sin RED posible); las mutaciones a mano en lectores se detectaron. T2 y T3: RED observado antes de implementar. Frontend: 312 archivos, 5065 pruebas.
