# 9.2 · El dueño ve la tasa por banco y empresa, y las fracciones de PPD (KAN-167, sin verificar en Jira)
Objetivo: que el dueño vea la tasa de desacuerdo por banco y por empresa, junto con las fracciones de PPD, parcialidades y comisiones, sin ver filas de ninguna empresa.
Rama: `feat/v2-9-2-medicion-plataforma`. Entrega: cadena de PR (backend, frontend). Pruebas: `npm test` (backend; no `npx jest`) y vitest (frontend).

## Specs
- S1: «ve la tasa de desacuerdo por banco y por empresa, con el número de propuestas evaluadas en cada una».
- S2: «cuando consulta una empresa, ve sus tres fracciones: facturas PPD sobre el total de facturas, movimientos de parcialidad sobre el total y comisiones sobre el total (historia 6.3)».
- S3: «una empresa con pocos datos» → «indica el tamaño de la muestra para que un porcentaje alto con pocos casos no engañe».
- S4: «una persona de una empresa» que intenta abrir la medición de plataforma → «recibe 403 y queda un acceso denegado».
- S5: «los montos y porcentajes» → «respetan el tema claro y oscuro y no se salen de su caja (UX-DR2, UX-DR3)».
- S6 (de 9.1/CLAUDE.md): la pantalla no tiene mockup → el mockup se crea y se acuerda antes de escribir la interfaz.

## Supuestos
- A1 (acordado con el usuario, 2026-11-17): el dueño ve el nombre (razón social) de cada empresa. La lectura que cruza empresas devuelve solo conteos y porcentajes: nunca montos, RFC de emisores ni ids de decisión.
- A2: ya existe `GET /plataforma/fracciones` (6.3) con razón social, totales y fracciones por empresa. S2 y la muestra de las fracciones del S3 se reutilizan; no se rehace.
- A3: falta el desacuerdo por banco y empresa. Función SQL `SECURITY DEFINER` nueva (mismo patrón que `fracciones_por_empresa()`), `GET /plataforma/desacuerdo`, sin guardar nada (AD-10).
- A4: la definición de 6.2 vive hoy en `SombraService.tasaDesacuerdo`. Para que no se desincronice, una prueba exige que la suma por empresa de la función sea igual a `tasaDesacuerdo(companyId)`.
- A5: `evidencia_sombra.banco` es nulable; los eventos sin banco se agrupan aparte («sin banco»).
- A6: extiende AD-5 (lectura agregada entre empresas, sin bitácora de empresa); se anota en la bitácora como desvío del spine.
- A7: el número KAN de la 9.2 no se pudo verificar (sin acceso a Jira desde la sesión).

## Tasks
- [x] T1 (S1,S3,S4; inline): migración con `desacuerdo_por_empresa_y_banco()`, servicio, `GET /plataforma/desacuerdo`, pruebas (agregados, 403 de empresa, equivalencia con 6.2).
- [x] T2 (S6): mockup de la pantalla del dueño (medición) en el lienzo, acordado con el usuario.
- [x] T3 (S1,S2,S3,S5; inline): frontend: sección del dueño, contrato, hook, página.
- [ ] T4: notas de cierre (`CUADRA.md`, `docs/bitacora.md`, Jira, repaso).

## Log
- L1 (2026-11-17): «continuemos donde lo dejamos» (siguiente historia según la lista: 9.2).
- L2 (2026-11-17): el usuario confirmó: «el dueño puede ver el nombre de cada empresa» y aprobó el límite de «solo conteos y porcentajes».
- L3 (2026-11-17): T1: RED real (8 pruebas con 404) y GREEN (8 de 8). Suite completa: 120 de 121 archivos; el que falló (`down-con-datos.migracion.spec.ts`) asumía que la 6.3 era la última migración: se actualizó y pasa. `eslint` limpio en lo tocado; los 5 errores de `plataforma.integracion.spec.ts` ya estaban en la base. Risk: item 2 (función SECURITY DEFINER que cruza empresas).
- L4 (2026-11-17): T2: el usuario eligió página aparte con pestañas en la cabecera del dueño y aprobó «los tableros» 20 · Plataforma: medición y 21 · Plataforma: medición (tema claro) (con PPD explicado como «pago en parcialidades o diferido»). Los tableros 10 y 11 ahora llevan las pestañas «Empresas y bancos» y «Medición».
- L5 (2026-11-17): T3 delegado a un escritor (razón: respaldo de contexto; mapeo previo hecho inline por la regla de lectura de lo que se iba a escribir). RED 16 de 16 (ruta, vista y pestañas inexistentes); GREEN: vitest 319 archivos y 5118 pruebas, typecheck y eslint limpios. Repetí vitest de plataforma y router (36 archivos, 635 pruebas). Único archivo fuera de la superficie: `frontend/src/app/router.test.tsx` (fija la lista exacta de rutas; se le añadió `/plataforma/medicion`). `PlataformaPage` se refactorizó a `MarcoPlataforma` sin cambiar su comportamiento. Risk: none (UI nueva; el refactor del marco lo cubren las pruebas existentes de plataforma).
