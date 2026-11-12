# 8.2 · Leer un PDF de Santander, incluso si trae contraseña (KAN-164)
Objetivo: lector puro de Santander (cuenta empresarial) y apertura de PDF protegidos con una contraseña que vive solo en memoria.
Rama: `feat/v2-8-2-lector-pdf-santander`. Entrega: cadena de 2 PR (backend, frontend) como 8.1. Pruebas: `npm test` (backend; no `npx jest`, hace falta `--experimental-vm-modules`) y vitest (frontend).

## Specs
- S1: «un lector puro de Santander devuelve saldos, movimientos normalizados y líneas no leídas, y pasa por el mismo cuadre, vista previa y rechazo que los otros bancos».
- S2: «un PDF protegido con contraseña» → «la pantalla le pide la contraseña, se usa solo en memoria para abrirlo y nunca se guarda ni se escribe en los registros».
- S3: «una contraseña incorrecta» → «se rechaza con un mensaje claro y no se crea ninguna carga».
- S4: «un PDF sin protección» → «no pide contraseña».
- S5: «es obligatoria para todas sus cargas, con su propio conteo» (vista previa de Santander).
- S6: «asigna `movimientos.clase` (`comision`, `parcialidad` o nula) con criterios documentados para este banco» [SUPUESTO: se afinan con PDFs reales].
- S7: «incluyen un PDF sintético con contraseña y otro sin ella, y verifican que la contraseña no aparece en ningún registro».

## Supuestos
- A1: no hay PDF real de Santander; layout sintético marcado [SUPUESTO], y también que Santander proteja sus PDF (la historia dice que sale de una guía).
- A2: `unpdf.getDocumentProxy(data, { password })` distingue `PasswordException` code 1 (falta) y 2 (incorrecta); verificado con un PDF cifrado hecho con `gs`.
- A3: contrato nuevo: campo opcional de texto `contrasena` en `POST /cargas/estado-cuenta/pdf`; códigos `pdf_requiere_contrasena` y `pdf_contrasena_incorrecta` (400). La pantalla muestra el campo solo tras `pdf_requiere_contrasena`.
- A4: sin migración (igual que 8.1); Santander aparece solo en `BANCOS_PDF`.
- A5: mockup «4 · Cargas (admin y contador)» actualizado antes del frontend (opción Santander, campo «Contraseña del PDF», dos estados nuevos), con el visto bueno del usuario.
- A6: `clasificarMovimiento` es común; solo se tocan palabras si el layout sintético las usa.

## Tasks
- [x] T1 (S2,S3,S4; inline): extractor con contraseña y los dos códigos de rechazo.
- [x] T2 (S1,S5,S6; inline): `lector-santander.ts`, registro, fixture sintético y pruebas del lector.
- [x] T3 (S2,S3,S4,S7; inline): campo `contrasena` en el endpoint, HTTP con PDF cifrado y sin cifrar, y la contraseña ausente de bitácora, respuestas y registros.
- [x] T4 (S2,S3,S4; inline): frontend: opción Santander, campo de contraseña, textos. Mockup 4 actualizado antes. RED observado (9 fallos) antes de implementar. Frontend: 311 archivos, 5051 pruebas en verde.
- [x] T5: notas de cierre (`CUADRA.md`, `docs/bitacora.md`).

## Log
- L1 (2026-11-12): «si arranca con esa. pero quiero que me expliques un poco eso de que si trae contraseña» y, tras la explicación, «si esta bien.» (historia 8.2 según la lista de historias).
- L2 (2026-11-12): decisión de implementación: pedir la contraseña (`pdf_requiere_contrasena`) es el primer paso normal de un PDF protegido, no un rechazo, así que no deja bitácora; una contraseña incorrecta sí (`pdf_contrasena_incorrecta`, sin la contraseña). Antes, un PDF protegido sin contraseña daba `pdf_ilegible`; ahora da `pdf_requiere_contrasena`.
- L3 (2026-11-12): backend verificado: 114 suites, 2137 pruebas en verde; RED observado en extractor (3 fallos) y HTTP (4 fallos) antes de implementar.
