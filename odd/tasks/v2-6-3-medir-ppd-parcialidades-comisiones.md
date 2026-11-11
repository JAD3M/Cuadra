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
- A5: `movimientos_pendientes` también lleva `clase` para que la vista previa la conserve al aceptar.

## Tasks
- [ ] T1 (S6; inline; Risk item 1 y 2: migración y función SECURITY DEFINER): migración con `clase` en `movimientos` y `movimientos_pendientes` + CHECK, `CLASES_MOVIMIENTO` en `tipos.ts` y espejo, prueba de deriva, y función `fracciones_por_empresa()`.
- [ ] T2 (S2; inline): `clasificarMovimiento` pura + pruebas + criterios documentados en el lector de BBVA y en los perfiles CSV.
- [ ] T3 (S2; inline): guardar `clase` en los tres INSERT (CSV, pendientes del PDF, aceptar vista previa). La clase no toca estado ni huella.
- [ ] T4 (S1, S3, S4, S5; inline; Risk item 2): servicio y `GET /plataforma/fracciones`, 403 para sesiones de empresa, pruebas contra Postgres real.
- [ ] T5: notas de cierre (`CUADRA.md`, `docs/bitacora.md`) y repaso.

## Log
- L1 (2026-11-11): «a okey entonces nos esperamos vamos con la 6.3».
