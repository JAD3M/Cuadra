# Ejemplos

Archivos **sintéticos** para demostrar y probar Cuadra sin datos de ninguna
persona real. Los genera `npm run ejemplos:generar` (`scripts/ejemplos/`); no se
editan a mano.

`bbva/` cuenta septiembre de 2026 de Ferretería (sintético):

- `estado-cuenta-septiembre-2026.pdf`: saldos que cuadran (8 movimientos).
- `estado-cuenta-septiembre-2026-no-cuadra.pdf`: el mismo estado con el saldo
  final alterado en 100.00; se rechaza completo.
- `estado-cuenta-septiembre-2026.csv`: el mismo estado en el perfil `cuadra`.
- `cfdi/`: nueve facturas del mismo mes.

Qué produce cada movimiento: regla 1 (`1,160.00`, ref. `A5001`), regla 2
(`2,300.00`, ref. `A5002` contra una factura de `2,320.00`), regla 3 (`3,480.00`
sin referencia), un depósito de `1,392.00` que cubre las facturas `5004` y
`5005`, un depósito ambiguo de `928.00` (dos facturas iguales), uno que apunta
a la factura cancelada `5008`, una comisión y un pago a proveedor. La factura
`5009` está en dólares.

Cada archivo está en `MANIFIESTO.json` con su origen (`sintetico` o `publico`).
Para probar con un estado real, lee [COMO-ANONIMIZAR.md](COMO-ANONIMIZAR.md).
