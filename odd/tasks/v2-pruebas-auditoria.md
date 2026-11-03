# Pruebas pendientes de la auditoría (v2, historias 1.1 a 3.6)

Rama: `chore/v2-pruebas-auditoria`
Fuente: auditoría de solo lectura del 2026-11-03. La enmienda del spine va en
otra rama (PR #76); este documento cubre los tres pendientes que quedaron fuera.

## Objetivo

Cerrar tres huecos de pruebas y de duplicación que la auditoría encontró, sin
tocar comportamiento de producción.

## Decisiones

- 2026-11-03, con el usuario: una sola rama con tres commits, uno por pendiente.
- Rama desde `master`, independiente de `chore/v2-enmienda-spine`.
- Los pendientes 4 de la auditoría (mirada visual de «Bancos» y rol migrador en
  producción) no son código y quedan con el usuario.

## Alcance autorizado

- Una prueba de integración nueva en `src/plataforma/` (la prueba debe poder
  nombrar tablas de clase 3; `cargas` no).
- Una prueba de que solo `sembrar-dueno.ts` crea dueños.
- `src/resolucion/resolucion.service.ts` y su prueba.
- No se adelantan historias.

## Tareas

- [x] T1 Prueba de integración de la 3.6 sin spy: el dueño levanta un banco por
  el endpoint real y luego una empresa sube un PDF de ese banco; el PDF que
  cuadra pasa directo a conciliación. Con el banco sin levantar sigue la vista
  previa. Comprobar que la prueba puede fallar (romper temporalmente el cableado
  y restaurarlo).
- [x] T2 Prueba de que la única inserción en `plataforma_usuarios` de código de
  producto está en `src/plataforma/sembrar-dueno.ts` (historia 1.3: no existe
  otra vía para crear dueños).
- [x] T3 `resolucion.service.ts:45`: derivar los roles de la matriz con
  `rolesConPermiso('conciliaciones.resolver')` en vez de repetirlos.

## Aceptación

Las tres pruebas pasan sobre el código actual; la de T1 falla si se rompe el
cableado entre `plataforma` y `cargas`; T3 no cambia el comportamiento.

## Progreso

- 2026-11-03: documento creado, ninguna tarea iniciada.
- 2026-11-03: T1, T2 y T3 hechas por el escritor, sin commits todavía.
  - T1: `src/plataforma/vista-previa-levantada.cableado.integracion.spec.ts`
    (2 pruebas, sin spy). Con `estaLevantado` roto temporalmente
    (`if (banco) return false;`) falló en `expect(estado).not.toBe('pendiente_vista_previa')`;
    el servicio se restauró con `git checkout` (`git diff` vacío).
  - T2: `buscarEscritoresDeDuenos` en `src/plataforma/arquitectura.ts` y
    `src/plataforma/unica-via-de-duenos.spec.ts`. RED observado
    (`buscarEscritoresDeDuenos is not a function`), luego verde; el repo real
    devuelve solo `plataforma/sembrar-dueno.ts`. Hoy solo existe la forma SQL;
    se cubre también `save/insert/upsert` del repositorio de `PlataformaUsuario`.
  - T3: `resolucion.service.ts` usa `[...rolesConPermiso('conciliaciones.resolver')]`
    (copia, sin cast: `rolesRequeridos` es `Rol[]`). Aserción nueva en
    `resolucion.integracion.spec.ts`, verde antes y después (RED no aplica:
    sin cambio de comportamiento).
  - Verificación: `npm test --` 78 suites / 1590 pruebas verdes; prettier,
    eslint y `tsc --noEmit` limpios.
