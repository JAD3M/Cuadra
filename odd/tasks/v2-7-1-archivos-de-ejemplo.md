# 7.1 · Preparar los archivos de ejemplo del demo (KAN-156)
Objetivo: un juego de archivos sintéticos (PDF de BBVA, CFDI y CSV equivalente) que cuente un mes completo y produzca casos de todos los tipos, con guía de anonimizado y una guarda contra subir archivos reales.
Rama: `feat/v2-7-1-archivos-de-ejemplo`. Entrega: un PR (cadena si pasa de ~400 líneas de código). Runner: `npm test -- <ruta>`.

## Specs
- S1: «hay al menos un PDF de estado de cuenta de BBVA con saldos que cuadran, los CFDI del mismo mes y un CSV equivalente».
- S2: «cada archivo está marcado como sintético o público, y ninguno contiene nombres, cuentas, CLABE ni RFC de personas reales».
- S3: «al cargarse completo produce casos de todos los tipos: pagos con referencia y monto exactos (regla 1), con monto distinto (regla 2) y con monto único (regla 3), un depósito que cubre varias facturas, un caso ambiguo, una factura cancelada, un movimiento que es comisión y un PDF cuyos saldos no cuadran».
- S4: «una guía corta explica cómo anonimizarlo (sin nombre, cuenta, CLABE ni RFC) y dice que nunca se sube al repositorio».
- S5: «las pruebas del lector de BBVA usan el texto del PDF sintético y los resultados coinciden con los saldos y el número de movimientos esperados».
- S6: «existe una regla (`.gitignore` o una prueba) que impide subir archivos marcados como reales».
- Fuera de alcance: PDFs de Banorte y Santander (épica 8); las pruebas de punta a punta (7.2 y 7.3).

## Supuestos
- A1: carpeta nueva `ejemplos/bbva/`, separada de `demo/` (CU-18, que tiene su propio runner y pruebas). No se toca la demo existente.
- A2: un mes (septiembre de 2026), empresa Ferretería, banco BBVA. Un generador puro `scripts/ejemplos/generar.ts` (misma tabla, mismos bytes) y una prueba de deriva que exige que lo commiteado sea su salida, como `demo-drift.spec.ts`.
- A3: reutiliza `escribirCfdi` y `escribirCsv` de `scripts/demo/formatos.ts` y `construirPdfSintetico`. Lo único que cambia en código compartido es un campo opcional `cancelado` en `CfdiDemo` (agrega `Estatus="Cancelado"`); sin él los bytes de la demo no cambian.
- A4: marca de origen: un `ejemplos/MANIFIESTO.json` lista cada archivo con `origen` `sintetico` o `publico`; la guarda falla si hay un archivo sin entrada, con otro origen (por ejemplo `real`), o si el nombre dice `real`. Además `.gitignore` ignora `ejemplos/real/` y `*.real.*`.
- A5: el caso ambiguo es `monto_multiples_candidatos` (dos facturas con el mismo total y un depósito sin referencia). La factura cancelada trae una referencia que la apunta. Lo que el motor produzca de verdad manda: si no coincide con lo declarado, se corrige el dato, nunca el motor.
- A6: se incluye también una factura en dólares (insumo de la 7.3).

## Tasks
- [ ] T1 (S1, S2, S3; inline): tabla del juego, generador, archivos generados (PDF que cuadra, PDF que no cuadra, CFDI, CSV equivalente) y `MANIFIESTO.json`.
- [ ] T2 (S1, S5; inline): pruebas del lector de BBVA y del cuadre sobre los PDF; CSV equivalente al PDF; deriva.
- [ ] T3 (S3; inline): prueba de punta a punta que carga el juego por HTTP y verifica un caso de cada tipo.
- [ ] T4 (S4, S6; inline): guía `ejemplos/COMO-ANONIMIZAR.md`, `.gitignore` y guarda del manifiesto.
- [ ] T5: notas de cierre (`CUADRA.md`, `docs/bitacora.md`) y repaso.

## Log
- L1 (2026-11-11): «sí, arranca con la 7.1».
