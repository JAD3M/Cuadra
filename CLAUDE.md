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

- Cada vez que se cree o modifique un mockup, se le dice al usuario su
  número: el del título del tablero en `project/canvas.json` (por
  ejemplo «2 · Bandeja de revisión»). Si son dos temas, los dos números.
  Se lee del lienzo, no de memoria.

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

## Al arrancar una sesión o una historia nueva

Antes de proponer o escribir nada, en este orden:

0. **Reglas y contexto:** lee `CUADRA.md` (no se carga solo) y ten
   presentes las «Reglas no negociables» de arriba. Los escritores y
   explicadores delegados parten en frío y no heredan este archivo:
   copia en cada prompt las reglas que aplican (`company_id`, `NUMERIC`,
   RLS, el motor decide y la IA solo sugiere, un falso positivo es peor
   que no conciliar).
1. **Epics:** `_bmad-output/planning-artifacts/epics.md`. Ubica la
   historia que sigue (la v2 se numera por épica: 4.1, 4.2…) y lee sus
   criterios de aceptación completos.
2. **Arquitectura:** `ARCHITECTURE-SPINE.md` (en
   `_bmad-output/planning-artifacts/architecture/`) y `arquitectura.ts`.
   Lee los AD que la historia cita en su línea «Cubre».
3. **Jira (proyecto KAN):** busca la historia y su estado. Al empezar
   pásala a En curso y al integrar los PR, a Finalizado. Las consultas
   JQL devuelven archivos enormes: extrae solo clave, estado y resumen
   con `jq`.
4. **Engram:** `mem_search` del cierre de la historia anterior, para
   saber qué dejó pendiente.
5. **Recién entonces** abre el documento ODD `odd/tasks/<historia>.md`
   y avanza tarea por tarea hasta el PR, sin pedir permiso entre
   pasos. Para solo cuando haya una duda real de producto.

Nunca deduzcas «lo que sigue» solo de la bitácora o de Engram: la lista
de historias manda.

## Al cerrar una historia: repaso

Cuando los PR de una historia quedan integrados, antes de pasar a la
siguiente, haz un repaso con el usuario. Es parte del cierre, no un
extra. Debe contestar, en corto:

1. **Objetivo:** qué pedía la historia (el «para qué» de sus criterios).
2. **Qué cambió:** lo construido, por tarea, y cómo cumple cada criterio.
3. **Qué resolvimos:** decisiones, desvíos del plan o del spine, y
   problemas que aparecieron en el camino, con su porqué.
4. **Qué quedó pendiente o en riesgo:** lo conocido, lo que se
   pospuso y a qué historia pasa.
5. **Qué aprendimos:** lo que conviene recordar en la siguiente.

Guárdalo en Engram con `mem_save` (tema `repaso/<historia>`, tipo
`decision`) y deja lo importante en la bitácora. Preséntalo al usuario
antes de proponer la historia que sigue.

Toda la implementación de una historia, backend y frontend, se trabaja
con ODD: un documento por historia en `odd/tasks/`, una historia a la
vez. Al terminar la historia se arma el PR (en cadena si pasa de 400
líneas de cambio).