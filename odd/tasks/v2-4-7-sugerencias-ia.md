# Historia 4.7: Sugerencias de la IA en los casos ambiguos

Rama: `feat/v2-4-7-sugerencias-ia`
Jira: KAN-143 (En curso)
Fuente: `_bmad-output/planning-artifacts/epics.md` (Story 4.7)
Spine: AD-21, AD-19
PRD: FR-64

## Objetivo

Verificar que el módulo `sugerencias` (CU-17) cumple los criterios de la 4.7 y cerrar
los huecos de prueba. La IA solo sugiere y nunca cierra un caso.

## Specs

- S1: corregir el criterio 1: la sugerencia vive en `decisiones`, no en `sugerencias_ia`.
- S2: «nunca viene marcada, nunca cierra el caso y no crea una decisión `confirmada`»:
  prueba de backend y prueba de frontend.
- S3 (fuera de alcance, decisión del usuario): no se prueba el LLM real ni se blinda el
  adaptador de Anthropic; la API no se paga.

## Tasks

- [x] T1 (S1) corregir el criterio en `epics.md` — inline
- [x] T2 (S2) prueba de backend: el módulo solo escribe `propuesta` sin persona — inline
- [x] T3 (S2) prueba de frontend: la sugerencia se muestra pendiente y no envía escrituras — inline
- [x] T4 bitácora y `CUADRA.md`

## Log

- L1 (2026-11-05): «hay que hacer esas dos pruebas de esos huecos. lo de el LLM real se
  hace con la api de anthropic? si es asi todavia no pagamos por ella ni creo que la
  vayamos a implementar [...] corrije el criterio para que diga que la sugerencia vive
  en decisiones»
- Las pruebas fijan comportamiento ya existente: no hay RED posible. Backend 49/49 en
  la suite de sugerencias; frontend 1 prueba nueva en verde.
Risk: none
