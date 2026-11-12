# 7.3 · Probar de punta a punta: Marisol concilia el mes (UJ-1) (KAN-158)
Objetivo: una prueba que recorra por HTTP la conciliación de un mes completo (cargas, motor, lote, descarte y reapertura), contra la API, Postgres y Redis reales.
Rama: `feat/v2-7-3-recorrido-uj1`. Entrega: un PR. Runner: `npm test -- <ruta>`.

## Specs
- S1: «la prueba sube el PDF sintético de BBVA y acepta la vista previa» → «los movimientos entran, y un PDF con saldos que no cuadran se rechaza completo con su motivo».
- S2: «los CFDI del mes» → «el motor propone parejas ordenadas por confianza, un depósito con varias facturas desmarcado y una factura en dólares con la nota "moneda no soportada"».
- S3: «la prueba confirma el lote de la regla 1» → «las decisiones quedan confirmadas con un solo `lote_id`, y la separación de funciones se respeta».
- S4: «un movimiento que no es de ningún cliente» → «la prueba lo descarta con motivo»: «sale de la bandeja y se puede deshacer».
- S5: «una confirmación hecha por error» → «la prueba reabre el lote con un motivo»: «los casos vuelven a la bandeja y la bitácora conserva quién y cuándo».
- S6: «los datos de otra empresa de prueba» → «con una sesión de la primera empresa»: «nunca ve datos de la otra».
- S7: «la prueba completa» → «no deja datos entre ejecuciones y corre en el CI».

## Supuestos
- A1: la empresa se crea como en 7.2 (S0 del criterio): el dueño de la plataforma da de alta dos empresas con RFC propio e invita a sus administradores por el correo simulado; la administradora invita a la contadora. Corrección del usuario (L2): una primera versión usaba las empresas del seed y no cumplía el criterio.
- A1b: los CFDI del juego salen a nombre del RFC de la Ferretería del seed y el motor solo concilia los emitidos por la empresa (`conciliacion.service.ts:83`); la prueba reescribe el `Rfc` del emisor en memoria. Los archivos de `ejemplos/` no cambian.
- A2: el juego es `ejemplos/bbva` (7.1): PDF que cuadra, PDF que no cuadra y nueve CFDI; lo esperado sale de `scripts/ejemplos/juego.ts`.
- A3: quien sube (Luis, contador) no puede confirmar (D-08); confirma Ana (administradora). La prueba comprueba el bloqueo de Luis y la confirmación de Ana.
- A4: la «nota moneda no soportada» se lee donde la API la expone (resultados de la carga de CFDI o el motivo del caso); se verifica en la prueba, no se inventa.
- A5: una sola prueba encadenada en `src/e2e/uj1-conciliar-el-mes.integracion.spec.ts`. Solo HTTP para actuar; la conexión del dueño solo para limpiar y comprobar que no queda nada.

## Tasks
- [x] T1 (hecha; sin RED posible: no hay código nuevo, las rutas ya existen; sin RED posible; prueba de control: tres roturas de producción, una a una, hacen fallar el recorrido (sin separación de funciones: 2 pasos; sin orden de confianza: 5; reabrir sin rastro en la bitácora: 1) y se revirtieron; GREEN: 7 pasos contra Postgres y Redis reales; eslint, prettier y tsc limpios) (S1-S7; inline): el recorrido encadenado.
- [x] T2: notas de cierre (`CUADRA.md`, `docs/bitacora.md`).

## Log
- L1 (2026-11-12): «vamos en donde lo dejamos» → «si arranca con eso» (historia 7.3 según la lista de historias).
- L2 (2026-11-12): «creo que prefiero el alta completa no crees que es la mejor opcion? hay que hacer RED y prueba de control como ves?»
