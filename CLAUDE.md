# Cuadra

Lee `CUADRA.md` antes de tocar nada. Ahí están el problema, la
arquitectura, las decisiones y las 18 historias con sus criterios.

## Reglas no negociables

- Ninguna query del dominio sale sin filtro de `company_id`.
- Montos siempre en `NUMERIC`. Nunca flotante.
- Columnas en `snake_case`; el ORM traduce a camelCase.
- El motor de reglas decide. El LLM solo sugiere en casos ambiguos
  y nunca cierra un caso.
- Un falso positivo es peor que no conciliar.

## Flujo

Trabajamos historia por historia (CU-01 … CU-18). No adelantes
historias. Al terminar una, corre los tests y actualiza la bitácora
de `CUADRA.md`.