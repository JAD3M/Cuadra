# Review (rubrica) - ARCHITECTURE-SPINE Cuadra v2

Revisor independiente, solo lectura. Contraste: PRD (FR-1..FR-70, secciones 4, 6, 7, 11) y codigo v1 (`src/`, `frontend/`).

## Veredicto

El spine ratifica bien el nucleo de la v1 (RLS, `alConfirmar`, `carga_archivos`, `tipos.ts` + deriva) y fija los grandes giros de la v2, pero deja sin decidir varios puntos donde dos unidades divergirian: el dueno de dos fuentes de estado en AD-4, la via de acceso a las tablas fuera de RLS, tablas nuevas sin dueno (invitaciones, comentarios, sesiones) y el despliegue/TLS. No esta listo para pasar a epicas sin corregir los hallazgos Alta.

## Hallazgos

### Alta

**H1. AD-4 es internamente inconsistente: un indice unico parcial no puede vivir en `decision_lineas` si el estado esta solo en la cabecera.**
- Rule: "Confirmar, rechazar, reabrir y descartar cambian solo la cabecera" y a la vez "una linea vigente por factura" (indice unico parcial).
- Un indice parcial solo ve columnas de su propia tabla; "vigente" depende de `decisiones.estado`. Hay que desnormalizar (`vigente`/`estado` en la linea, y entonces ya no se cambia solo la cabecera) o usar trigger/exclusion; el spine no elige. Dos unidades lo resolverian distinto. Es justo el invariante de FR-11 (una sola vigente por CFDI, seccion 11 del PRD).

**H2. Doble propiedad del estado: `movimientos.estado`, `cfdi.estado` y `decisiones.estado`.**
- En v1: `movimientos.estado IN (abierto, conciliado, descartado)` y `cfdi.estado IN (abierta, conciliada, cancelada)` (EsquemaInicial.ts). AD-4 dice evitar "dos lugares dueños del estado de una confirmacion", pero no dice si esos estados se derivan, se mantienen en la misma sentencia o se eliminan. AD-9 ademas introduce `pendiente_revision` (estado de movimiento) fuera del CHECK vigente; AD-8/9 introducen `pendiente_vista_previa` en `cargas.estado` (CHECK vigente: pendiente/procesando/procesada/fallida). Faltan los nuevos CHECK y quien los escribe.
- `deshacer_descarte` (FR-21) no tiene estado destino en la lista de estados de `decisiones` (`propuesta, confirmada, rechazada, reabierta, descartada`): ¿`reabierta`? ¿borra la fila? Ambiguo.

**H3. Tablas fuera de RLS: el spine ratifica la excepcion de la v1 pero no decide la via de acceso que el PRD exige.**
- PRD seccion 5/11: `companies`, `users`, `user_company_roles` "se tocan solo por una via con permisos propios y con pruebas de que un usuario no puede listar ni unirse a empresas ajenas". AD-2 solo dice "ya estan fuera de RLS en la v1".
- Codigo: la migracion de aislamiento da a `cuadra_app` solo `GRANT SELECT` sobre esas tres tablas (AislamientoRls.ts:83) y un `GRANT UPDATE (tolerancia_monto)` puntual. F6 (crear empresa, invitar, cambiar/quitar rol, `separacion_funciones`) exige INSERT/UPDATE/DELETE (o borrar fila de rol). El spine no decide grants, ni rol de DB aparte para plataforma, ni la prueba de no-listar-empresas-ajenas. FR-39, FR-41, FR-45, FR-48, FR-49 quedan sin dueño estructural.
- `/auth/empresas` (v1, `@Get('empresas')`) lista empresas del usuario sin RLS; la regla que lo protege no esta en ningun AD.

**H4. Tablas nuevas sin decision de aislamiento ni forma: invitaciones/recuperacion, comentarios (FR-68), sesiones, verificacion de cargas.**
- AD-14 habla de "token guardado con hash" sin nombrar tabla, columnas ni si lleva `company_id`/RLS. AD-2 dice que las unicas tablas sin `company_id` son las de AD-5 mas tres de v1; `sesiones` (tipo `plataforma` con `company_id` elegida nula) e invitaciones contradicen o dejan abierta esa lista. FR-68 (comentario sobre caso) no tiene tabla ni accion definida mas alla de `comentar`.
- AD-6 no define el estado intermedio de "elegir empresa": la v1 usa un JWT de seleccion de 5 min (`auth.module.ts`, `DURACION_SELECCION`). ¿Cookie de sesion sin empresa? ¿Cambiar de empresa en la misma sesion? Es el flujo de UJ-1 (Marisol con tres empresas).

**H5. Despliegue y transporte: la cookie de AD-6 y el limite por IP de AD-15 dependen de decisiones que quedan implicitas o diferidas.**
- AD-6 no exige `Secure` y no hay decision de TLS ni de quien sirve el frontend en produccion (AD-15 solo menciona "proxy de desarrollo"; AD-17 difiere el host). Sin TLS/reverse proxy no hay `Secure`, ni IP real (`trust proxy`) para el "5 intentos por minuto por direccion" (FR-58). Es un punto donde dos unidades (auth y despliegue) divergen.
- Cookie + `SameSite=Strict` sin decidir CSRF/validacion de `Origin` en mutaciones. FR-57 (CORS) solo aparece de pasada en AD-15; no hay regla propia ni hay CORS en la v1 (`rg` no encuentra `enableCors`).

### Media

**H6. FR-69 (fracciones PPD / parcialidades / comisiones) no es calculable con el modelo de AD-10.**
- `evidencia_sombra` es una fila por propuesta de regla 1; las tres fracciones de FR-69 son sobre facturas totales y movimientos totales (incluye parcialidades y comisiones, que no tienen deteccion definida). AD-10 dice "se calculan por consulta" pero no hay de donde sacar "movimiento que forma parte de una parcialidad" ni "cargo de comision". Falta decidir el dato (clasificacion en carga o consulta) y que FR-69 empiece en 2a (FR-38).

**H7. AD-7/AD-12: renombrar `conciliaciones` a `decisiones` toca mas que las tablas.**
- `ENTIDADES_BITACORA = ['conciliaciones','companies']` y su CHECK, los registros historicos de bitacora que referencian `conciliaciones`, el indice `ux_conciliaciones_par`, y los datos v1 existentes. El spine no decide migracion de datos, compatibilidad ni rollback (la regla `ck_conciliaciones_confirmada_requiere_persona` se "equivale" pero no se dice como se traslada). Tambien la ruta de descarte con `persona` obligatoria: AD-3 cubre solo `confirmada`, no `descartada`.

**H8. Cobertura de FR sin AD ni fila de Capability que los gobierne.**
- FR-8 (historial de cargas) y FR-9 (quien carga: cubierto solo por AD-11 indirectamente), FR-16/FR-17 (orden por confianza y bandeja), FR-24 (aviso de empresa sin separacion), FR-46 (ultimo admin: requiere regla transaccional contra carrera), FR-47/FR-48 (lista de usuarios, cuenta unica), FR-60 (secretos, solo implicito en AD-17), FR-62 (prueba real con la IA), FR-63 (reglas de muestreo: 5%/20, verificador, no quien confirmo; AD-10 solo dice que la muestra se guarda), FR-64 (fallback si el LLM falla), FR-66 (asignar `cancelada` desde el XML), FR-3 (conteo de 5 cargas por banco, concurrencia). Privacidad del PRD seccion 5 ("lista cerrada de campos al proveedor de IA") no esta en ningun AD.
- `sugerencias` esta en el mapa pero ningun AD nuevo ratifica la lista cerrada de campos.

**H9. Contrato de lectores de PDF atado a una libreria diferida (AD-8 vs Deferred).**
- AD-8 fija `texto -> {...}` (texto plano), pero la libreria de extraccion se difiere; segun la libreria el texto pierde o conserva posicion/columnas, lo que cambia lo que un lector puede hacer. Diferir la libreria es razonable, pero el contrato de entrada (texto plano vs items con coordenadas) debe fijarse ahora porque los lectores de BBVA/Banorte/Santander lo consumen en paralelo. Tambien: coexistencia con los perfiles JSON de CSV de la v1 (`src/bancos/perfiles/*.json`) no esta dicha ("un banco nuevo es codigo" solo para PDF).

**H10. Dimensiones estructurales sin decidir ni diferir: operaciones y entornos.**
- Sin entradas para: observabilidad (logs, metricas, alertas; existe `src/health`), entornos (dev/test/staging/prod, CI), gestion de secretos mas alla de "variables de entorno" (FR-60), restauracion de respaldos y retencion, rendimiento del parseo de PDF en el worker (10 MB, "segundos" del PRD), politica de hash de contrasenas y de re-uso de tokens. Seguridad y datos estan cubiertos en parte; operaciones no.

### Baja

**H11. Versiones del Stack.** Coinciden con `package.json` y `docker-compose.yml` de la v1 (NestJS ^11, TypeORM ^1.1.1, pg ^8.23, BullMQ ^6.3, Vite ^8, Vitest ^5, react-router ^8, TS ~6.0, Postgres 18, Redis 7), asi que ratifican; no hay verificacion externa de "vigente" en octubre de 2026 y el spine no dice que la hizo. Faltan en la tabla: ioredis, multer, y la libreria de correo (diferida).

**H12. AD-1 ambiguo.** "Servicios acceden a datos solo con SQL parametrizado por `ContextoEmpresa.manager()`" convive con entidades TypeORM (`*.entity.ts`, `conciliacion.entity.ts`); no queda claro si el uso de repositorios/QueryBuilder esta permitido. Regla no verificable por lint.

**H13. Playwright y la "puerta de salida de la fase 1" quedan como Deferred/pregunta**; el segundo no puede hacer divergir unidades, pero la puerta de FR-70/seccion 7 depende de el.

## Afirmaciones sobre la v1 contrastadas

Confirmadas por el codigo: `alConfirmar` (contexto-empresa.ts:40, cargas.service.ts:295), `TransaccionEmpresa.ejecutar`, `uuidv7()`, `NUMERIC(18,4)`, `ENABLE`/`FORCE RLS`, `cuadra_app NOBYPASSRLS`, `companies/users/user_company_roles` fuera de RLS, `carga_archivos`, `jobId = cargaId`, `ROLES_QUE_EDITAN_TOLERANCIA` solo en frontend, `synchronize:false`, JWT de 15 min (D-09), prueba de deriva (`frontend/tests/dominio/deriva.test.ts`), `ck_conciliaciones_confirmada_requiere_persona`, bitacora con 7 acciones.

Puntos a precisar: `TABLAS_CON_RLS` y `TABLAS_DOMINIO` existen en `src/database/esquema.spec.ts`/`rls.spec.ts`/migracion (son listas de pruebas/migracion, no un registro de runtime); "ok" pero la regla "registrarlas" es una convencion de prueba. No se verifico el "patron CTE de la v1" citado en AD-7.

## Que si funciona

AD-2, AD-3, AD-12, AD-13, AD-16 son aplicables y previenen su divergencia declarada; el mapa Capability->AD cubre F1..F8; Deferred esta bien acotado salvo H9. El estilo "ratifica / reemplaza" (D-09, D-11) coincide con la seccion 11 del PRD.
