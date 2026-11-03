# Enmienda del spine tras la auditoría de arquitectura (v2, historias 1.1 a 3.6)

Rama: `chore/v2-enmienda-spine`
Fuente: auditoría de solo lectura del 2026-11-03 (arquitectura contra
`ARCHITECTURE-SPINE.md` y criterios de aceptación de las historias 1.1 a 3.6).

## Objetivo

Que el spine describa lo que el código hace a propósito, y que una prueba de
arquitectura vigile esas reglas, para que una historia nueva no las rompa sin
que nada falle.

## Problema

La auditoría no encontró fugas entre empresas, dinero en flotante ni tablas sin
RLS. Sí encontró desviaciones de forma que ningún test vigila:

- **B2:** `usuarios/`, `invitaciones/` y `recuperacion/` escriben tablas de
  identidad (clase 2), y el spine dice que solo `auth` y `companies` las tocan.
  El propio spine ubica «usuarios, roles, invitaciones» dentro de `companies/`.
- **B1:** `cargas_aceptadas_por_banco()` (`SECURITY DEFINER`) es la única salida
  de RLS del sistema y ningún test vigila quién la llama.
- **B3:** `bitacora_plataforma` tiene `company_id` informativo (nullable, sin FK).
- **B5:** `movimientos_pendientes` tiene `GRANT DELETE`.

## Decisiones

- 2026-11-03, con el usuario: se **enmienda el spine** para B2 (no se mueve el
  código). Se legalizan `usuarios/`, `invitaciones/` y `recuperacion/` como
  módulos de identidad y se agrega una prueba de arquitectura que fija qué
  módulos pueden **escribir** las tablas de clase 2. La lectura (por ejemplo el
  `JOIN users` para mostrar nombres) se mantiene permitida.
- B3, B5 y la excepción de B1 se registran en el spine como desviaciones
  deliberadas, con su motivo.

## Alcance autorizado

- `ARCHITECTURE-SPINE.md` (AD-2 y la estructura de módulos).
- `src/plataforma/arquitectura.ts` y las pruebas de arquitectura.
- Bitácora del proyecto.
- Fuera de alcance (se decide aparte): el test de integración de la 3.6 sin spy,
  el test de que solo `sembrar-dueno.ts` crea dueños y la lista de roles de
  `resolucion.service.ts`.

## Tareas

- [x] T1 Enmendar el spine: B2 (seis módulos de identidad escriben, dos
  excepciones nombradas, lectura libre), B3, B5 y la excepción de B1. Evidencia:
  `ARCHITECTURE-SPINE.md` (AD-2 clase 2, desviaciones, estructura de módulos).
- [x] T2 Pruebas de arquitectura. RED observado (20 de 20 fallaban: la función
  no existía), luego GREEN. `buscarEscriturasIdentidad` en
  `src/plataforma/arquitectura.ts`, specs en `arquitectura-identidad.spec.ts`;
  `cargas_aceptadas_por_banco` en `NOMBRES_CLASE_3`. Sin escrituras nuevas fuera
  de la lista en el repositorio real.
- [x] T3 Bitácora y cierre: entrada del 3 nov en `docs/bitacora.md`.

## Aceptación

Las pruebas de arquitectura pasan sobre el código actual y fallan con fixtures
que violan cada regla. El spine y la prueba dicen lo mismo.

## Progreso

- 2026-11-03: documento creado, ninguna tarea iniciada.
- 2026-11-03: decisión del usuario (opción A): `plataforma/` es módulo de
  identidad; semillas y ayudante de pruebas son excepciones nombradas. T1-T3
  hechas; arquitectura 27/27, suite completa, prettier, eslint y tsc verificados.
- 2026-11-03: cierre de proceso: PR #76 integrado en master.
