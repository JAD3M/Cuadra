# 8.1 · Leer un PDF de Banorte (KAN-163)
Objetivo: un lector puro de Banorte (cuenta empresarial) que entra al mismo flujo de cuadre, vista previa y rechazos que BBVA.
Rama: `feat/v2-8-1-lector-pdf-banorte`. Entrega: PR en cadena si pasa de 400 líneas. Pruebas: jest (backend), vitest (frontend).

## Specs
- S1: «un lector puro de Banorte devuelve el saldo inicial, el saldo final, los movimientos normalizados (los mismos campos que BBVA y el CSV) y las líneas que no pudo leer».
- S2: «pasa por la misma función común de cuadre de saldos, la misma vista previa y el mismo rechazo completo si no cuadra».
- S3: «Un PDF escaneado, de más de 10 MB o que no está en MXN» → «se rechaza con los mismos motivos y mensajes que para BBVA».
- S4: «es obligatoria para todas las cargas de Banorte, y su conteo de cargas revisadas es independiente del de BBVA».
- S5: «asigna `movimientos.clase` (`comision`, `parcialidad` o nula) con criterios documentados para este banco» [SUPUESTO: se afinan con PDFs reales].
- S6: «usan texto de un PDF sintético o anonimizado de Banorte, marcado como tal, y nunca un estado de cuenta real en el repositorio».
- S7: «se escribe para la cuenta empresarial y rechaza con un mensaje claro un PDF cuyo diseño no reconoce».
- S8: «el contador lo sube eligiendo Banorte» (frontend: selector de banco; hoy `CargasContenedor` envía BBVA fijo).

## Supuestos
- A1: no hay PDF real de Banorte; el diseño del lector y del fixture es un supuesto, marcado como tal (decisión del usuario, 2026-11-12).
- A2: `clasificarMovimiento` es común a todos los bancos; se agregan palabras de Banorte con su prueba solo si el diseño sintético las usa.
- A3: sin migración (contadores por consulta, `cargas.banco` es texto libre).
- A4: `EstadoCuentaLeido` y `LineaNoLeida` se mueven a un módulo común antes del segundo lector.
- A5: S8 exige leer el mockup de Cargas antes de tocar la pantalla; si el mockup no tiene selector de banco, se actualiza el mockup primero.

## Tasks
- [x] T1 (S1,S7; inline): tipos comunes + `lector-banorte.ts` + pruebas unitarias.
- [x] T2 (S2,S3,S4,S5,S6; inline): registro en `lectores-pdf.ts`, fixture sintético y LEEME, integración HTTP, ajustes a pruebas que asumen un solo banco.
- [ ] T3 (S8; inline): selector de banco en el frontend, tras leer el mockup.
- [ ] T4: notas de cierre (`CUADRA.md`, `docs/bitacora.md`).

## Log
- L1 (2026-11-12): «arranca con eso» (historia 8.1 según la lista de historias) y «arranca con el sintético de mientras. todavia incluso me falta el de BBVA y ahora de el banorte para conseguirlo».
