# 6.3 · Medir cuántos movimientos son PPD, parcialidades o comisiones (KAN-155)
Objetivo: que el dueño vea, por empresa, tres fracciones (PPD, parcialidades, comisiones) para decidir si alguno de esos casos entra a la v2. Solo mide: nunca cambia ni cierra una conciliación.
Rama: `feat/v2-6-3-clase-de-movimiento`. Entrega: un PR (cadena si pasa de ~400 líneas). Runner: backend `npm test -- <ruta>`, frontend `npx vitest run`.

## Specs
- S1: «es el número de facturas con método de pago PPD entre el total de facturas de esa empresa».
- S2: «una función pura lo clasifica» y «se guarda en `movimientos.clase` como `comision`, `parcialidad` o nula, con criterios iniciales documentados en cada lector de banco [SUPUESTO: se afinan con PDFs reales]» y «la clasificación nunca cambia la conciliación ni cierra nada».
- S3: «los movimientos de clase `parcialidad` entre el total de movimientos, y los de clase `comision` entre el total de movimientos».
- S4: «las ve por empresa en un reporte de solo lectura, y se calculan por consulta, sin guardarse».
- S5: «un administrador o contador de una empresa [que] intenta ver las fracciones de otra empresa recibe 403, porque son de plataforma».
- S6: «se registra en `tipos.ts`, en su espejo, en el `CHECK` y en la prueba de deriva».
- Fuera de alcance: la pantalla (épica 9, historia 9.2).

## Supuestos (a confirmar al ver PDFs reales)
- A1: `clase` es nulable y no hay relleno de los movimientos ya importados: quedan nulos. Las fracciones de clase solo reflejan lo importado desde esta historia.
- A2: «total de facturas» = todas las filas de `cfdi` de la empresa (cualquier estado y tipo). «Total de movimientos» = todas las filas de `movimientos` de la empresa.
- A3: criterios iniciales, sobre la descripción en mayúsculas sin acentos: `comision` = cargo (monto < 0) cuya descripción contiene «COMISION»; `parcialidad` = abono (monto > 0) cuya descripción contiene «PARCIALIDAD», «PAGO PARCIAL» o «ABONO PARCIAL». Cualquier otro caso es nulo. Un movimiento no puede ser las dos.
- A4: el reporte es `GET /plataforma/fracciones` (sesión de plataforma), con una función SQL `SECURITY DEFINER` que solo agrega por empresa, igual que `cargas_aceptadas_por_banco()`.
- A5 (corregido al implementar): `movimientos_pendientes` NO lleva `clase`; al aceptar la vista previa la clase se calcula con la misma función pura sobre la descripción y el monto de cada fila en espera. Una columna menos y una sola fuente.

## Tasks
- [x] T1 (hecha; Risk item 1 y 2; `down()` no probado con datos) (S6; inline): migración `1790721000000-ClaseDeMovimiento` con `clase` en `movimientos` + CHECK, `CLASES_MOVIMIENTO` en `tipos.ts` y espejo, prueba de deriva, y función `fracciones_por_empresa()`.
- [x] T2 (hecha; RED: módulo inexistente; GREEN: 9 pruebas) (S2; inline): `clasificarMovimiento` pura + pruebas. Los criterios iniciales quedan documentados en la función (comunes a todo banco) y en `CUADRA.md`, no repetidos en cada lector: los CSV son perfiles de solo datos y el lector de BBVA solo entrega la descripción.
- [x] T3 (hecha; RED: 2 pruebas fallaban; GREEN: 94 pruebas de estado de cuenta y vista previa) (S2; inline): guardar `clase` en los dos INSERT a `movimientos` (CSV y aceptar vista previa); el de `movimientos_pendientes` no cambia (A5). La clase no toca estado ni huella.
- [x] T4 (hecha; RED: 5 de 5 fallan sin el endpoint; GREEN: 5 pruebas contra Postgres real; Risk item 2) (S1, S3, S4, S5; inline): servicio y `GET /plataforma/fracciones`, 403 para sesiones de empresa, pruebas contra Postgres real.
- [ ] T5: notas de cierre (`CUADRA.md`, `docs/bitacora.md`) y repaso.

## Log
- L1 (2026-11-11): «a okey entonces nos esperamos vamos con la 6.3».
