# 7.2 · Probar de punta a punta: Carlos deja lista su empresa (UJ-2) (KAN-157)
Objetivo: una prueba que recorra por HTTP el alta completa de una empresa y su equipo, contra la API, Postgres y Redis reales y el correo simulado.
Rama: `feat/v2-7-2-recorrido-uj2`. Entrega: un PR. Runner: `npm test -- <ruta>`.

## Specs
- S1: «el dueño inicia sesión, crea una empresa con un RFC, invita a un administrador y el administrador acepta la invitación leyendo el enlace del correo simulado».
- S2: «invita a tres personas con distintos roles, cada una acepta y su menú muestra exactamente lo que le corresponde».
- S3: «la prueba reenvía [una invitación pendiente]: el enlace anterior deja de servir y el nuevo funciona».
- S4: «el único administrador de la empresa: la prueba intenta quitarle el rol: se rechaza».
- S5: «un administrador al que se le quita el rol de una empresa [con su sesión]: pierde el acceso a esa empresa en su siguiente petición y conserva las otras».
- S6: «el CI del repositorio: corre el flujo de integración con PostgreSQL y Redis como servicios y falla el CI si el recorrido falla».

## Supuestos
- A1: no existe un endpoint de menú; el «menú» de una persona es `capacidades` de `GET /auth/contexto` (el frontend lo traduce a su navegación en `ELEMENTOS_NAV`). La prueba compara contra `permisosDeRoles([rol])` de la matriz, no contra una lista escrita a mano.
- A2: S5 usa dos empresas con el mismo administrador. Para poder quitarle el rol en una, la otra tiene un segundo administrador (no se puede dejar sin administrador). Su cookie vieja de la empresa A recibe 401 (así lo fija el servicio) y la de B sigue sirviendo.
- A3: S6 ya se cumple sin tocar `ci.yml`: el job `pruebas` corre `npm test` con Postgres y Redis como servicios y toda `*.spec.ts` bajo `src/` entra; la prueba lleva el prefijo de Redis y la limpieza propios.
- A4: una sola prueba encadenada, en `src/e2e/uj2-alta-empresa.integracion.spec.ts`. Solo HTTP; el dueño y el estado inicial se siembran como en las demás integraciones (no hay ruta para sembrar al dueño).

## Tasks
- [x] T1 (hecha; sin RED posible: no hay código nuevo, las rutas ya existen; una mutación de control hizo fallar 2 de 5 pasos; GREEN: 5 pasos contra Postgres y Redis reales) (S1-S6; inline): el recorrido encadenado.
- [ ] T2: notas de cierre (`CUADRA.md`, `docs/bitacora.md`).

## Log
- L1 (2026-11-11): «sí, arranca con la 7.2».
