# 9.1 · Ver la tasa de desacuerdo de mi empresa (KAN-166)
Objetivo: que el administrador vea con qué frecuencia su equipo no está de acuerdo con las propuestas de la regla 1, calculada por consulta sobre `evidencia_sombra`.
Rama: `feat/v2-9-1-tasa-de-desacuerdo`. Entrega: cadena de PR (backend, frontend). Pruebas: `npm test` (backend; no `npx jest`) y vitest (frontend).

## Specs
- S1: «ve la tasa de desacuerdo de su empresa, con cuántas propuestas de la regla 1 se evaluaron y cuántas tuvieron desacuerdo».
- S2: «sale de una consulta sobre los eventos, con la definición de la historia 6.2, y no de un número guardado».
- S3: «una persona con rol `contador`, `revisor` o `auditor`» → «recibe 403 y la sección no aparece en su menú».
- S4: «una empresa sin propuestas de la regla 1 todavía» → «ve un mensaje claro de que aún no hay datos, y no un cero engañoso».
- S5: «la administración de otra empresa» → «nunca ve los datos de la empresa ajena».
- S6: «la pantalla no tiene mockup» → «el mockup se crea y se acuerda antes de escribir la interfaz (UX-DR1, UX-DR9)».

## Supuestos
- A1: el cálculo ya existe: `SombraService.tasaDesacuerdo(companyId)` devuelve `{propuestas, tratadas, desacuerdos, tasa}` con la definición de 6.2 (`tasa = desacuerdos / tratadas`; una desmarcada que sigue pendiente aún no entra). La 9.1 solo lo expone.
- A2: endpoint `GET /medicion/desacuerdo` en `SombraModule`, con permiso nuevo `medicion.ver` solo para `admin` (matriz + espejo del frontend, mismo orden). La empresa sale de la sesión.
- A3: la tasa viaja como texto (no flotante), tal como la devuelve el servicio.
- A4: «aún no hay datos» = `propuestas === 0`; con propuestas pero ninguna tratada, la tasa es `null` y se muestra «todavía no hay propuestas tratadas», no un cero.
- A5: sección «Medición» en el menú (solo con `medicion.ver`), ruta propia; el mockup lo crea esta historia en el lienzo (tablero nuevo).
- A6: sin migración.

## Tasks
- [x] T1 (S1,S2,S3,S4,S5; inline): permiso `medicion.ver`, `GET /medicion/desacuerdo`, pruebas HTTP.
- [x] T2 (S6): mockup de Medición en el lienzo, acordado con el usuario.
- [x] T3 (S1,S3,S4; inline): frontend: permiso espejo, menú, ruta, página, hook y contrato.
- [x] T4: notas de cierre (`CUADRA.md`, `docs/bitacora.md`).

## Log
- L1 (2026-11-12): «vamos con la epica 9 entonces. y seguimos con 9.1» (historia 9.1 según la lista de historias).
- L2 (2026-11-12): el usuario aprobó el tablero «19 · Medición (admin)» tal como quedó (solo tema oscuro).
- L3 (2026-11-12): backend: RED real (404 sin el controlador) y 120 suites, 2188 pruebas en verde. Frontend: RED observado (4 archivos no cargaban y 13 pruebas fallaban) y 317 archivos, 5096 pruebas en verde. ESLint del backend marca 4 errores en `src/plataforma/plataforma.integracion.spec.ts`, un archivo que esta historia no toca.
