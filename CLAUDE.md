# Cuadra

Lee `CUADRA.md` antes de tocar nada. Ahí están el problema, la
arquitectura, las decisiones y las historias.

La bitácora vive aparte, en `docs/bitacora.md`. Es historial: no la
leas completa; búscala solo cuando necesites saber cómo se llegó a
algo.

## Reglas no negociables

- Ninguna query del dominio sale sin filtro de `company_id`.
- Montos siempre en `NUMERIC`. Nunca flotante.
- Columnas en `snake_case`; el ORM traduce a camelCase.
- El motor de reglas decide. El LLM solo sugiere en casos ambiguos
  y nunca cierra un caso.
- Un falso positivo es peor que no conciliar.
- Toda tabla de dominio nueva lleva company_id, RLS con FORCE y su
  política, y GRANTs explícitos para cuadra_app en la misma migración.

## Frontend

El diseño de referencia son los mockups aprobados en Claude Design:
https://claude.ai/artifact/YNdRfrAaG7qQGqfS4wNJP7 (canvas privado; se
lee con la herramienta Artifact, archivos `project/*.dc.html`).

- Toda pantalla se basa en su mockup: distribución, jerarquía,
  estados, textos, colores y tipografías. Antes de construir o cambiar
  una pantalla, lee su mockup.
- Pantallas: login y empresa, bandeja, detalle del caso, cargas,
  tolerancia y bitácora.
- Si una pantalla necesita algo que el mockup no tiene, primero se
  actualiza el mockup y se acuerda; después se escribe el código.
- Tema claro y oscuro, con un control para cambiar entre ellos. El
  oscuro es el de los mockups; el claro usa los mismos roles de color.
- Un monto nunca se sale de su contenedor: no se parte en dos líneas
  y la caja crece con el número.
- Los montos no pasan por flotante tampoco en el frontend.
- Estados, reglas, roles y acciones salen del backend
  (`src/common/entities/tipos.ts`); el frontend no inventa valores.
- El frontend no decide ni cierra casos: confirmar y rechazar pasan
  por la API. Validar en el navegador es comodidad; la seguridad es la
  del servidor.

## Flujo

Trabajamos historia por historia (CU-01 … CU-26). No adelantes
historias. Al terminar una, corre los tests, agrega la entrada en
`docs/bitacora.md` y actualiza el estado en `CUADRA.md`.

El frontend se trabaja con SDD, un cambio a la vez.