# Revisión adversaria — ARCHITECTURE-SPINE (Cuadra v2)

Método: pares de unidades construidas por separado que cumplen cada AD al pie de la letra y aun así no encajan. Evidencia: PRD y código v1 (`src/resolucion/resolucion.service.ts`, `src/conciliacion/candado.ts`, `src/database/migrations/*`, `src/database/transaccion-empresa.interceptor.ts`).

Veredicto: el spine fija bien el "qué" de cada tabla, pero deja sin dueño la concurrencia (el candado de v1 desaparece), la máquina de estados de `decisiones`, la migración de datos v1 y la frontera de roles de base de datos. Con los ADs actuales dos equipos honestos construyen sistemas incompatibles.

---

## H-1 [ALTA] Los índices únicos de AD-4 no se pueden construir como están escritos

**Par:** U-A (migración de `decisiones`/`decision_lineas`) y U-B (servicio de confirmar). AD-4 pide "una línea vigente por factura" como índice único parcial, pero la vigencia es el estado de la **cabecera**, y un índice parcial no ve otra tabla. A la vez AD-4 exige que confirmar/rechazar/reabrir cambien "solo la cabecera". U-A, para cumplir el índice, copia `estado` a `decision_lineas`; U-B, para cumplir "solo la cabecera", nunca lo actualiza. Resultado: la copia queda `propuesta` para siempre y el índice no protege nada (o bloquea todo, si U-A lo hizo `NOT NULL DEFAULT 'confirmada'`).
Segundo ángulo: v1 tiene `ux_conciliaciones_cfdi_confirmada` y `..._movimiento_confirmada` (EsquemaInicial:80-83). AD-4 solo nombra el equivalente por movimiento.

**Cierre:** nuevo AD (o ampliar AD-4): `decision_lineas` lleva `company_id`, `estado_vigente boolean` (o `vigente`) mantenida por un trigger de la cabecera, con `ux_decision_lineas_factura_vigente (company_id, cfdi_id) WHERE vigente`. Prohibido mantenerla desde el servicio. Alternativa: `decision_lineas.vigente` en la misma sentencia CTE que cambia la cabecera, declarado excepción a "solo la cabecera".

## H-2 [ALTA] Sin candado de empresa: el AD que lo protege en v1 no existe en v2

**Evidencia:** v1 serializa `conciliar()`, confirmar, rechazar y sugerencias con `pg_advisory_xact_lock(hashtextextended('conciliar:'||company))` (`candado.ts`, usado en `resolucion.service.ts` y `persistencia-sugerencias.ts`), tomado **antes** de cualquier fila para fijar orden de bloqueo. El spine no lo menciona (ni en AD-2, AD-4, AD-16).

**Pares:**
1. Dos confirmaciones del mismo movimiento (dos pestañas): U-A confirma la propuesta P1 (conjunto {F1,F2}), U-B confirma P2 (conjunto {F3}) del mismo movimiento. El índice "una decisión vigente por movimiento" evita el doble final, pero la perdedora aborta con 23505 → 500 en vez de 409, y la ganadora no rechazó a las hermanas.
2. Dos movimientos distintos proponen la misma factura F1 (propuestas distintas, huella distinta). Confirmar M1 y M2 en paralelo: el índice por factura rechaza una con error, pero **nadie rechaza las propuestas hermanas** que v1 sí rechaza (`resolucion.service.ts:134-140`, `MOTIVO_HERMANA`). AD-4 no dice que confirmar rechace propuestas que comparten factura. Una equipo lo implementa, otro no.
3. Orden de bloqueo: un servicio de lote bloquea movimientos en orden de la bandeja, otro en orden de id → deadlock.
4. Reabrir un lote mientras otro usuario confirma un lote que comparte facturas con casos reabiertos: sin candado, el "omitidos: N" de FR-33 es no determinista.

**Cierre:** nuevo AD de concurrencia: todo servicio que muta `decisiones`/`decision_lineas`/estados de `movimientos` y `cfdi` (confirmar, rechazar, reabrir, descartar, lote, `conciliar()`, sugerencias, importación de cargas) toma `tomarCandadoDeConciliacion` primero y luego bloquea filas en orden `cfdi_id`, `movimiento_id` ascendente. Confirmar una decisión rechaza (misma sentencia) las propuestas hermanas que comparten factura o movimiento. Un conflicto de índice único se traduce a 409, nunca a 500.

## H-3 [ALTA] Máquina de estados de `decisiones` sin tabla de transiciones

AD-4 lista cinco estados y cuatro verbos, pero no las transiciones legales. Huecos construibles:

| Hueco | U-A entiende | U-B entiende |
| --- | --- | --- |
| `rechazada` → algo | terminal | se puede "des-rechazar" (FR del auditor/comentario) |
| `reabierta` → ? | terminal (historial) | vuelve a `propuesta` para reconfirmar |
| `deshacer_descarte` (AD-7) | `descartada` → `reabierta` | borra la decisión / `descartada` → `propuesta` |
| descarte de un movimiento con propuesta viva | pasa las propuestas a `rechazada` | las deja en `propuesta` (índice único "vigente" no las cubre y chocan con el descarte) |
| confirmar `propuesta` de un movimiento ya `descartada` | falla | lo permite (la vigente es solo una) |

Consecuencias en datos: el CHECK `ck_decisiones_estado` y los índices parciales dependen de la respuesta. Además `descartada` y `confirmada` comparten el índice "una vigente por movimiento", pero `tipo=descarte` con `estado=confirmada` es combinable (¿tabla 5×2 = 10 combinaciones, cuáles válidas?). Falta CHECK `ck_decisiones_tipo_estado`.
Y: "la reconfirmación crea una decisión nueva": ¿nace `confirmada` directa (sin pasar por `propuesta`, y por lo tanto sin entrar al único `(movimiento, huella)` de propuesta/rechazada) o nace `propuesta`? Si nace `propuesta` con la misma huella que la `reabierta`, está permitido porque `reabierta` no está en el índice; pero si el usuario la rechaza después, ya existe… ninguna otra `rechazada`, así que pasa; luego el motor la "no vuelve" a proponer por la `rechazada`, pero el historial de la reabierta no cuenta. Dos equipos implementan el filtro del motor distinto.

**Cierre:** AD-4 incorpora la tabla cerrada de transiciones:
`propuesta→confirmada|rechazada`; `confirmada→reabierta`; `reabierta` y `rechazada` terminales; `descartada→reabierta`; la reconfirmación inserta una decisión nueva `propuesta`→`confirmada` por la misma ruta que cualquier confirmación (reglas de separación incluidas, FR-28). Cada transición es un `UPDATE ... WHERE estado = <origen>` con `rowCount` verificado, más `ck_decisiones_tipo_estado` (descarte solo `descartada|reabierta`; conciliación nunca `descartada`). Descartar rechaza en la misma transacción las propuestas vivas del movimiento.

## H-4 [ALTA] `DELETE`, `UPDATE` y RLS de las tablas de usuarios/sesión contradicen AD-2

**Evidencia:** en v1 `cuadra_app` solo tiene `SELECT` sobre `companies, users, user_company_roles` (`AislamientoRls.ts:83`) y están fuera de RLS; AD-2 mantiene "sin DELETE".

**Pares:**
- AD-6 dice "cerrar sesión, quitar un rol o dar de baja **borra la fila**" de `sesiones`; AD-2 prohíbe `DELETE` a `cuadra_app`. U-A (auth) concede `DELETE` solo para `sesiones`; U-B (companies) quita el rol con `DELETE` en `user_company_roles` y los GRANT actuales no alcanzan. Cada equipo abre el GRANT que necesita sin acuerdo.
- `sesiones` tiene `company_id` (nulo antes de elegir empresa) y no aparece en la lista de excepciones de AD-2 ni de AD-5. Con `FORCE RLS` y `app.company_id` sin fijar, la búsqueda por hash en la petición (que ocurre **antes** de que el interceptor abra la transacción con empresa) devuelve cero filas. Sin RLS, un administrador con SQL injection lee sesiones de otras empresas.
- `user_company_roles` tiene `company_id` y sigue fuera de RLS (AD-2 lo declara así): un `admin` que invita/cambia rol (F6) consulta roles con filtro manual, justo el error que AD-2 dice prevenir. Las tablas nuevas de tokens (invitaciones, recuperación) no están clasificadas ni en AD-2 ni en AD-5.

**Cierre:** nuevo AD de "clasificación de tablas": cada tabla es de empresa (RLS) o de plataforma/identidad (sin RLS) y aparece en una lista cerrada con sus GRANTs exactos. `sesiones`, `invitaciones` y `tokens_recuperacion` son de identidad: se consultan por hash en un servicio dedicado que corre con un rol/ruta propia fuera de la transacción de empresa; `DELETE` se concede explícitamente solo a `sesiones` y a `user_company_roles` en la migración que las crea (excepción a "sin DELETE" nombrada en AD-2). `user_company_roles` pasa a RLS por `company_id` o se declara que solo `companies/` la toca.

## H-5 [ALTA] Frontera plataforma/empresa solo existe en el guard, no en la base de datos

AD-5 separa mundos con un guard, pero las tablas de plataforma (`plataforma_usuarios`, `bancos_vista_previa`, `bitacora_plataforma`) no tienen RLS ni `company_id` y las toca el **mismo rol** `cuadra_app`.

**Pares:**
- U-A (cargas) incrementa el conteo de "cargas revisadas por banco" en `bancos_vista_previa` desde el worker de empresa (AD-16, `TransaccionEmpresa.ejecutar`). U-B (plataforma) lo trata como dato solo del dueño. Un solo UPDATE global desde N empresas = fila caliente y el bloqueo se mantiene dentro de la transacción de empresa; además un bug en cualquier consulta de empresa puede leer `plataforma_usuarios` (hashes del dueño).
- Acciones de plataforma que "escriben además en la bitácora de esa empresa" (AD-5): la petición de plataforma no trae empresa, el interceptor (`user.scope !== 'sesion'` → no abre transacción) no la envuelve, así que U-A escribe `bitacora_plataforma` en su propia transacción y U-B abre `TransaccionEmpresa.ejecutar` aparte. No es atómico: un fallo deja una bitácora sin la otra, contra AD-7 ("misma transacción").
- `desactivar_separacion` (AD-13) cambia `companies` (no es tabla RLS) pero `cuadra_app` solo tiene `SELECT` sobre ella: ¿quién tiene `UPDATE`?

**Cierre:** AD de roles de base de datos: rol `cuadra_plataforma` distinto de `cuadra_app`, con sus propios GRANTs sobre las tablas de plataforma y `UPDATE` acotado a columnas de `companies`; `cuadra_app` sin acceso a tablas de plataforma. El conteo de vista previa se **calcula por consulta** desde `cargas` (como AD-10), no se incrementa. Las acciones de plataforma que tocan una empresa corren en una única transacción que fija `app.company_id` y escribe ambas bitácoras.

## H-6 [ALTA] Migración de `conciliaciones` a `decisiones`: sin orden ni correspondencia de datos

**Evidencia:** v1 tiene una fila por par (cfdi, movimiento) con `cfdi_id`, `origen`, `regla`, `score`, `diferencia_monto`, `motivo` y llaves foráneas compuestas (`LlavesCompuestasConciliacion.ts:36,39`); `sugerencias_ia` y `ResultadoExplicado` referencian el modelo. La `bitacora` de v1 usa el id de la conciliación como `entidad_id`.

**Pares:**
- U-A (migración) hace `DROP TABLE conciliaciones` tras copiar; U-B (reglas, historia de bitácora) conserva la referencia de bitácora a `entidad_id`. Si `decisiones.id` ≠ `conciliaciones.id`, toda la bitácora v1 apunta a nada.
- AD-4 enumera columnas de la cabecera (`movimiento_id, tipo, estado, persona, fecha, lote_id, motivo, requiere_revision, diferencia`) pero omite `origen`, `regla`, `score`, `company_id`; sin `regla` no existe "propuestas de la regla 1" para el lote (FR-19), el modo sombra (AD-10) ni el muestreo. U-A (conciliación) y U-B (sombra) añaden cada uno su columna de regla con nombre distinto.
- Una conciliación v1 `propuesta` ya tiene par 1:1; el índice nuevo `(movimiento, huella)` necesita la huella del conjunto de facturas: nadie define su función (¿sha de `cfdi_id`s ordenados?). Dos implementaciones (reglas vs. migración) producirían huellas distintas y los pares rechazados volverían a proponerse.
- Orden de migraciones: GRANT/RLS/CHECK de bitácora (`ck_bitacora_accion`, AD-7) y tablas de AD-10 (`decision_id` FK) dependen de que `decisiones` exista antes; sin orden declarado, la migración de sombra falla en entorno limpio.

**Cierre:** AD de migración: orden fijo (1 `decisiones`/`decision_lineas` con backfill que **conserva el id** y `origen/regla/score`, 2 bitácora CHECK, 3 `evidencia_sombra`/`muestras_verificacion`, 4 `DROP conciliaciones`), `huella_conjunto` como función pura única en `conciliacion/` usada por motor y migración, y la lista completa de columnas de cabecera en el spine. La prueba de integración corre la migración sobre datos v1 sembrados.

## H-7 [MEDIA] Cargas concurrentes con la misma huella y `pendiente_vista_previa`

AD-9: índice **no único** `(company_id, huella)` y resumen "N nuevos, M ya existentes" calculado al leer el archivo.

**Pares:**
- Dos cargas (PDF y CSV del mismo mes) procesan en workers distintos al mismo tiempo; ambas consultan huellas existentes, ninguna ve a la otra, ambas muestran "N nuevos". Al confirmar las dos, el mes queda duplicado y el índice no único no lo impide.
- Una carga en `pendiente_vista_previa` ¿ya insertó `movimientos`? Si sí, entran en `conciliar()` y la bandeja antes de que la persona confirme (contradice la vista previa); si no, quién guarda el resumen y cómo se recalcula si otra carga entró entre la vista previa y la confirmación (resumen obsoleto).
- Nada define el estado de la carga respecto de la extracción de texto vs. `sha256` (dos cargas con el mismo archivo concurrentes dependen de `ux_cargas_company_id_hash_archivo`, que sí existe en v1 y debe nombrarse).

**Cierre:** AD-9 se amplía: el calculo de duplicados y la inserción final corren bajo el candado de empresa; la confirmación de la vista previa **recalcula** el resumen y rechaza (409) si cambió; mientras la carga está en `pendiente_vista_previa` los movimientos viven en `carga_archivos`/tabla de preparación y no en `movimientos`.

## H-8 [MEDIA] Invalidar sesión frente al interceptor de transacción

AD-6: cada petición busca la sesión y lee roles de la base; AD-2: el interceptor abre la transacción con `app.company_id`.

**Pares:** U-A hace la búsqueda de sesión y roles en el guard (fuera de la transacción, snapshot propio); U-B, al quitar un rol, borra las sesiones dentro de otra transacción. Una petición larga (lote de 144 confirmaciones) ya pasó el guard y termina de confirmar con un rol que ya no tiene (TOCTOU). Además: la renovación de `ultima_actividad` en cada GET, si corre dentro de la transacción de empresa, se pierde en cada rollback y genera contención sobre la misma fila; si corre fuera, es una escritura extra por petición sin definir. El interceptor actual (`scope === 'sesion'`) está acoplado al JWT de v1; con AD-6 cambia a `tipo`, y `scope` de "selección de empresa" (sesión sin empresa) no tiene equivalente declarado.

**Cierre:** el guard resuelve sesión y roles **dentro** de la transacción de empresa (mismo snapshot que el servicio, `FOR SHARE` sobre `user_company_roles`), la renovación de actividad se hace como máximo una vez por minuto fuera de la transacción, y la sesión pre-empresa se modela como `tipo='empresa'` con `company_id NULL` y rutas permitidas enumeradas.

## H-9 [MEDIA] `bitacora` vs. `bitacora_plataforma`: acciones y CHECK duplicados

AD-7 enumera nueve acciones nuevas, pero no dice a cuál bitácora pertenece cada una. `invitar`, `cambiar_rol`, `quitar_rol` las dispara tanto el admin de empresa como el dueño (plataforma crea la empresa y la primera invitación). U-A pone `invitar` en el CHECK de `bitacora`; U-B pone el mismo valor en el CHECK de `bitacora_plataforma` con otra forma de `antes/despues`. La prueba de deriva (AD-12) cuenta una lista única en `tipos.ts` y falla o, peor, se parchea con la unión. Además `desactivar_separacion` va a ambas bitácoras (AD-13) pero con la misma acción: ¿misma cadena, mismo `entidad_id`?

**Cierre:** AD-7 gana una tabla acción → bitácora(s) → forma de `antes/despues`, con `ACCIONES_EMPRESA` y `ACCIONES_PLATAFORMA` como listas separadas en `tipos.ts`; las acciones dobles se registran con el mismo `correlacion_id`.

## H-10 [MEDIA] Reabrir lote vs. lote en confirmación; lote parcial

FR-31..33: `lote_id` por confirmación en lote, reabrir un lote reabre "los que sigan confirmados".

- ¿El lote se confirma en **una** transacción (atómico) o por caso? AD-4 solo promete atomicidad por decisión. Si un caso falla (CFDI cancelado mientras tanto, FR-66) ¿falla el lote o se omite? U-A (resolución) lo implementa todo-o-nada; U-B (frontend) asume omitir y mostrar conteo.
- Reabrir un lote mientras otro usuario aún lo está confirmando por tandas: el `lote_id` ya existe con algunos casos `confirmada` y otros aún `propuesta`; el reabrir toma "los que sigan confirmados" y el resto se confirma después, quedando un lote a medias reabierto.
- `requiere_revision` (FR-66) en un caso de un lote: ¿reabrir el lote lo incluye?

**Cierre:** el lote se genera y confirma en una transacción bajo candado, con el `lote_id` creado en esa misma sentencia (estado de lote implícito: todo-o-nada), o el lote es una entidad con estado propio; elegir y escribirlo. Reabrir lote omite explícitamente `requiere_revision` solo si el motivo lo cubre (declararlo).

## H-11 [BAJA] Formas de datos compartidas sin dueño único

- `diferencia del grupo` en cabecera vs. `diferencia_monto` por línea de v1: el total de líneas ≠ diferencia, nadie dice quién calcula.
- `evidencia_sombra.respuesta` (confirmó, rechazó, desmarcó, reabrió) incluye **desmarcó**, que ocurre en el navegador antes de existir una decisión: ¿lo registra el frontend por API? Contradice "el frontend no decide" y no tiene endpoint en el spine.
- `muestras_verificacion.decision_id` apunta a una decisión que puede pasar a `reabierta`; la tasa "por consulta" debe fijar a qué versión se refiere.

**Cierre:** nombrar el módulo dueño de cada columna derivada y añadir el endpoint de `desmarcar` al flujo de lote.

---

## Resumen de cierres propuestos (nuevos o tocados ADs)

1. AD-4: tabla de transiciones + `vigente` mantenida por trigger + CHECK tipo/estado + columnas completas.
2. Nuevo AD-19: candado de empresa y orden de bloqueo para toda mutación.
3. Nuevo AD-20: clasificación de tablas (empresa / identidad / plataforma), roles `cuadra_app` y `cuadra_plataforma`, GRANTs y DELETE nombrados.
4. Nuevo AD-21: migración v1→v2 con orden, backfill con ids conservados y `huella_conjunto` única.
5. AD-6: guard dentro de la transacción de empresa y renovación acotada.
6. AD-7: tabla acción → bitácora.
7. AD-9: recalcular bajo candado; movimientos fuera de `movimientos` mientras `pendiente_vista_previa`.
