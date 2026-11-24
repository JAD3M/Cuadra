# 9.5 · Saber si se cumple la condición para considerar el cierre automático (KAN-170)
Objetivo: que el dueño vea, en Plataforma · Medición, si los datos de todas las empresas cumplen la condición del PRD para considerar el cierre automático, y cuánto falta, sin activar nada.
Rama: `feat/v2-9-5-condicion-cierre-automatico`. Entrega: PR en cadena si pasa de 400 líneas (backend, luego frontend). Pruebas: `npm test` (backend; no `npx jest`) y la suite del frontend.

## Specs
- S1: «ve si hay al menos 1,000 propuestas de la regla 1, en al menos 3 empresas distintas y durante al menos 3 meses, y cuántas faltan para cada umbral».
- S2: «se muestran por separado la tasa de las respuestas registradas y la de la muestra verificada».
- S3: «la condición se evalúa con la más alta de las dos» (tasa <= 0.5 %) [SUPUESTO: criterio conservador, de la historia].
- S4: «solo informa; no activa nada, y el cierre automático sigue sin existir en la v2».
- S5: «el resultado cambia en la siguiente consulta, porque se calcula y no se guarda».
- S6: «Given una persona de una empresa / When intenta abrir la condición / Then recibe 403, porque es de plataforma».
- S7: pantalla según los mockups 20 · Plataforma: medición y 21 · Plataforma: medición (tema claro), con la sección «Condición para considerar el cierre automático», aprobados por el usuario el 2026-11-24.

## Supuestos
- A1 (mockup aprobado): «meses» = meses calendario distintos (UTC) con al menos una propuesta de la regla 1; no el lapso entre la primera y hoy.
- A2 (mockup aprobado): una tasa sin casos no cuenta como cumplida. Mío, conservador: si falta una de las dos medidas (sin tratadas o sin verificados), el criterio de la tasa no se cumple, porque un falso positivo es peor que no conciliar.
- A3: la población de «propuestas de la regla 1» es la de `desacuerdo_por_empresa_y_banco()` (9.2): decisiones con evento `habria_cerrado`. Así la suma coincide con la tasa de la 6.2 y no se define dos veces.
- A4: tasa de las respuestas registradas = suma de desacuerdos / suma de tratadas de todas las empresas (la definición de la 6.2). Tasa de la muestra verificada = casos cuya última marca es `desacuerdo` / casos con alguna marca (por empresa, mes y decisión; vale la última, 9.4).
- A5: el servidor decide si se cumple y cuánto falta; el frontend solo pinta. La comparación es entera, sin flotante: `d/n <= 0.005` equivale a `200·d <= n`; la más alta de dos tasas se compara por productos cruzados. Las tasas viajan como texto de cuatro decimales, como en 9.1/9.2.
- A6: conteos nuevos en una función `SECURITY DEFINER` solo de conteos (sin ids, montos ni RFC), con las mismas reglas que `desacuerdo_por_empresa_y_banco()`: `search_path` fijo, EXECUTE solo para `cuadra_app`, dueño que se salta RLS. No hay tabla nueva ni nada guardado.
- A7: ruta `GET /plataforma/condicion-cierre`, sesión `plataforma`; una sesión de empresa recibe 403 y queda en su bitácora como las demás rutas de plataforma.

## Tasks
- [ ] T1 (S1,S2,S3,S4,S5,S6; inline): backend: migración con la función de conteos, servicio con la evaluación pura, DTO, ruta en `PlataformaController`, pruebas (unitarias de la evaluación; integración: umbrales, reapertura y verificación que cambian el resultado, 403 y 401).
- [ ] T2 (S1,S2,S3,S4,S7; inline): frontend: contrato, hook, vista (estados cargando, error, sin datos, no cumple, cumple), sección en `MedicionPlataformaPage`, tema claro y oscuro, pruebas.
- [ ] T3 (inline): notas de cierre (`CUADRA.md`, `docs/bitacora.md`), Jira KAN-170 y repaso de la historia (y cierre de la épica 9).

## Log
- L1 (2026-11-24): «si agregalo» (la sección de la condición en los mockups 20 y 21) → «aprobado, arranca con el documento ODD».
- L2 (2026-11-24): mapa: función de referencia `desacuerdo_por_empresa_y_banco()` (migración `1790722000000`), `src/plataforma/desacuerdo-plataforma.service.ts` y su ruta `GET /plataforma/desacuerdo` en `plataforma.controller.ts`; en el frontend `frontend/src/features/plataforma/` (`useDesacuerdoPlataforma.ts`, `vistaMedicionPlataforma.ts`, `MedicionPlataformaPage.tsx`, `components/`). La marca de la muestra vive en `muestras_verificacion` (solo agregar, `resultado` nulo en la fila del sorteo).
