# Cuadra — bitácora

> Historial del proyecto, día por día: cada cambio de decisión, alcance o plan.
> Lo más reciente arriba. El contexto vigente está en [`CUADRA.md`](../CUADRA.md).

### 13 oct 2026

- **Historia 1.3 de la v2: pantalla interna del dueño de Cuadra (KAN-118,
  FR-67 parte, AD-2, AD-5).** Rama `feat/v2-1-3-pantalla-dueno` con ODD, cuatro
  tareas de backend. Frontend bloqueado hasta que el mockup de la pantalla
  interna exista y se acuerde (UX-DR1, UX-DR9):
  - **T1 `1beabe6`:** `plataforma_usuarios` y `bitacora_plataforma` (clase 3,
    sin RLS; la bitácora solo `SELECT` e `INSERT`). `sesiones` gana
    `plataforma_usuario_id` con FK y `ck_sesiones_sujeto_por_tipo`: `user_id`
    o `plataforma_usuario_id` según el tipo (decisión de la persona usuaria).
  - **T2 `21d8789`:** `npm run sembrar:dueno` con `DUENO_CORREO` y
    `DUENO_PASSWORD`. Mínimo de 12 caracteres, solo en esta siembra (decisión
    de la persona usuaria; el repo no tenía regla). Se niega si la tabla ya
    tiene filas y no existe ningún endpoint de alta.
  - **T3 `d0cefca`:** login y cierre bajo `/plataforma`, mismo 401 genérico y
    límite; una sesión empresa en `/plataforma/*` y una plataforma en una ruta
    de empresa responden 403 y quedan en `bitacora_plataforma`. CHECK de
    acciones (AD-7) con su espejo en el frontend. Una sesión plataforma nunca
    abre transacción de empresa (spy en el interceptor). Reemplaza el 401 de
    la 1.1 para sesiones `plataforma`.
  - **T4 `b0ea1c6`:** prueba de arquitectura: falla si un módulo fuera de
    `plataforma/` nombra las tablas o entidades de clase 3 (lista blanca por
    archivo y nombre; migraciones y comentarios fuera).
  - **T6b `f5786b6`:** `GET /plataforma/auth/me` para restaurar la sesión del
    dueño al recargar; 401 si el dueño está inactivo y sin escritura en la
    bitácora al leer.
  - **T6c `ce3c509`:** frontend de plataforma según el mockup acordado
    (artboards 10 y 11 del canvas): `/plataforma/login` y `/plataforma`, sesión
    propia separada de la de empresa, `RutaPlataforma`, textos de error
    propios. Corrección: el proveedor de sesión de empresa ya no se monta en
    `/plataforma`, porque pedía `/auth/contexto` con la cookie del dueño y
    dejaba un acceso denegado en cada carga.
- **Flujo:** `CLAUDE.md` pasa toda la implementación de una historia (backend
  y frontend) a ODD, con PR al terminar la historia.
- **Revisión nativa:** T1 a T3 salieron de riesgo alto (autenticación) y la
  persona usuaria declinó esa revisión. T4 quedó bajo presupuesto. T6b y T6c
  (riesgo alto) se revisaron con 4 lentes y quedaron aprobadas; los hallazgos
  no bloqueantes de T6c están en el documento ODD (reintentos de `/me` sin
  espera, el cierre de sesión que oculta fallas del logout y la decisión
  por prefijo en `Providers`). La evaluación de riesgo de T1 a T3 se corrió
  una sola vez sobre el rango, no tras cada commit.
- **Pendientes de la 1.3:** (a) `GET /plataforma/empresas` devuelve `[]` fijo:
  `companies` tiene RLS FORCE y leerla sin `company_id` exigiría saltarla, se
  resuelve en la 1.4; (b) los intentos fallidos de login del dueño no se
  registran en `bitacora_plataforma` (sin usuario conocido; filas controladas
  por un atacante); (c) agregar `DUENO_CORREO` y `DUENO_PASSWORD` a
  `.env.example` a mano; (d) `npm run sembrar:dueno` no se ha ejecutado contra
  la base de desarrollo; (e) mockup de la pantalla interna.

- **Historia 1.2 de la v2: límite de peticiones y origen autorizado
  (KAN-117, FR-57, FR-58).** Rama `feat/v2-1-2-limite-y-origen`, tres tareas
  con revisión nativa aprobada (4 lentes cada una). Reemplaza la delegación
  del límite a un proxy (D-11):
  - **T1 `62a9847`:** cliente Redis compartido con timeouts cortos y sin cola
    offline, `configurarApp` usada por `main.ts` y por los helpers de prueba
    (`trust proxy` por `TRUST_PROXY`, CORS con el origen exacto) y la variable
    obligatoria `ORIGEN_AUTORIZADO`.
  - **T2 `b6e5fba`:** `@Limite({ intentos, ventanaS })` declarativo. Reserva
    atómica en Redis (Lua) y devolución si la respuesta es 2xx, para que
    adivinar en paralelo no esquive el límite y un intento correcto no
    consuma. Login: 5 fallidos por minuto por dirección, 429 con
    `Retry-After`. Con Redis caído responde 503 (**falla cerrada**, decisión de
    la persona usuaria).
  - **T3 `370830d`:** toda petición que cambia datos exige `Origin` igual a
    `ORIGEN_AUTORIZADO`; sin él, 403 sin cambios. Corre antes del límite, así
    que un origen incorrecto no consume intentos. Unos 14 specs y el runner
    de la demo migraron a un envoltorio de `supertest` que agrega el `Origin`.
- **Pendientes de la 1.2:** (a) el mensaje 429 dice «Espera un minuto» fijo
  aunque `@Limite` acepta cualquier ventana (`limite.guard.ts`); (b) las
  claves del límite reutilizan `COLA_PREFIJO`; (c) en producción
  `ORIGEN_AUTORIZADO` debe ser el origen real del frontend o toda escritura
  responde 403; (d) la API no arranca en desarrollo sin `ORIGEN_AUTORIZADO` en
  el `.env` local.

- **Historia 1.1 de la v2: sesión con cookie que el servidor puede cancelar
  (KAN-116, FR-59).** Implementada con ODD en la rama
  `feat/v2-1-1-sesiones-con-cookie`, sin push ni PR. Reemplaza el JWT de dos
  tokens de la v1 (D-09) por una fila en `sesiones` (AD-2, AD-6):
  - **T1 `27905cc`:** tabla `sesiones` sin RLS (clase 2), entidad `Sesion` y
    `GRANT SELECT, INSERT, UPDATE, DELETE` a `cuadra_app`. Un test comprueba que
    `sesiones` es la única tabla pública donde `cuadra_app` puede borrar.
  - **T2 `dcb2cef`:** `SesionesService`, guarda por cookie `cuadra_sesion`
    (guarda solo el hash SHA-256), login, elegir empresa con rotación del
    token, logout y vencimiento a las 8 h con renovación por actividad. Los
    tests y helpers que usaban Bearer pasaron a cookie.
  - **T3 `9742d22`:** se retiran `@nestjs/jwt`, `JWT_SECRET` y las menciones
    a Bearer en Swagger.
  - **T4 `1decfa1`:** el frontend manda la cookie, ya no guarda token, y
    recargar la página conserva la sesión. La pantalla de login no cambia.
  - **T6 `8369e38` y `c5d4fd9`: cambiar de empresa con la sesión viva
    (AD-6).** `GET /auth/empresas` y `POST /auth/empresa/:id` aceptan la
    sesión con y sin empresa; cambiar actualiza la misma fila y rota el token,
    y un 403 la deja igual. El frontend ya no pide la contraseña al cambiar y
    conoce `puedeCambiarEmpresa` tras recargar.
  - **T7 `74bf686`: `RolesGuard` exige `@Roles` aunque el endpoint acepte la
    sesión sin empresa.** La omisión de membresía para endpoints con
    `'seleccion'` solo aplica si el endpoint no declara `@Roles`; cinco tests
    fijan la interacción. Cierra el hallazgo de la revisión de T6.
- **Revisión nativa.** El rango completo excedió el presupuesto de los
  revisores (`lens_context_budget_exceeded`) y se dividió. Backend T1 a T3 y
  backend T6 y backend T7: aprobados con 4 lentes. Frontend T4 y T5 (47
  archivos): también
  excedió el presupuesto; se omitió por decisión de la persona usuaria, porque
  la seguridad de la sesión vive en el backend.
- **Decisiones:** `Origin` y límite de peticiones quedan para la historia 1.2.
  Las sesiones de tipo `plataforma` responden 401 hasta la historia 1.3.
- **Puntos abiertos (fuera de la 1.1):**
  1. **Sesiones vencidas sin purga:** solo se borran al cerrar sesión, así que
     `sesiones` crece sin cota (`sesiones.service.ts`).
  2. **Una escritura por petición:** el guard hace SELECT y UPDATE en cada
     petición autenticada y las concurrentes de una misma sesión se
     serializan sobre la fila (`sesion-cookie.guard.ts`).
  3. **Sin nombre de usuario** al retomar la elección de empresa tras
     recargar: ningún endpoint lo devuelve.
  4. **Pruebas intermitentes:**
     `src/cargas/cargas.listado.integracion.spec.ts:336` (ya existía) falla
     cuando un UUID aleatorio contiene «77», y `src/database/esquema.spec.ts`
     («usa el índice parcial al buscar CFDI abiertas por emisor») falló una
     vez en una corrida completa y pasó al repetirla.

### 7 oct 2026

- **Backend verificado con Postgres 18 en el equipo del usuario: 39 suites y
  852 pruebas en verde**, incluidas las dos guardas de esquema que exigen
  PG18 (en la nube fallaban con PG16) y las de la bitácora. Se corrió en un
  contenedor desechable `node:24-alpine` con el código, los `node_modules` y la
  red del `api` (`docker run --volumes-from cuadra-api-1 --network
  cuadra_default ...`), porque dentro del `api` (Node 22) 18 suites no
  arrancan: Jest 30 no carga `@nestjs/bullmq`, `config`, `jwt` ni `typeorm`,
  que en las versiones instaladas son solo ESM y piden Node 24.9 o más. CU-26
  no tocó dependencias ni Docker; el problema es del entorno y queda como
  pendiente aparte.
- **Pendientes fuera de CU-26:**
  1. **Node 24 para las pruebas del backend**: subir `Dockerfile.dev` a
     `node:24-alpine` (o fijar las versiones CommonJS de los paquetes de Nest)
     y anotar en el README la versión mínima.
  2. **Jest no termina solo** («did not exit one second after the test run»):
     queda algún recurso abierto al final de la suite; revisar con
     `--detectOpenHandles`.
- **CU-26 integrado a `master`** en el repo del usuario por avance rápido de
  `446d9da` a `dbbca02`, desde un bundle de git (la sesión en la nube no tiene
  remoto). En su equipo, el frontend da 239 archivos y 3,941 pruebas en verde,
  igual que en la nube. Falta correr el backend con su Docker (Postgres 18) y
  la revisión manual en el navegador.
- **Ajuste a la especificación (BIT-10).** El usuario tenía, sin commit, su
  versión de `claves.ts` y `errores.ts` de la bitácora; se movieron a un
  respaldo antes del merge y se compararon. `claves.ts` era equivalente (solo
  cambiaban comentarios); de sus pruebas se suma la que arma la clave con el
  `armarConsulta` real y la referencia a BIT-1.5. `errores.ts` se reemplaza por
  su versión, que sigue BIT-10: un 401 no muestra mensaje (lo atiende la
  sesión) y una respuesta fuera de contrato es «otro», no «conexión»; nunca lee
  `mensajes` del servidor. 239 archivos y 3,946 pruebas en verde.
- **CU-26 terminado: bitácora en pantalla (KAN-104).** Con ella van 26 de 26
  historias y 99 de 99 puntos. Vive en la cadena local de ramas
  `feat/cu-26-06-claves-hooks` a `feat/cu-26-11-kit-docs` (U1 a U5 están en
  la base de la primera), sin push ni PR, y **no está integrada a `master`**:
  falta la revisión del usuario. Lo entregado:
  - Pantalla `/bitacora` en lugar del marcador, con la maqueta aprobada
    (`Bitacora.dc.html`, solo oscuro; el claro sale de los mismos roles de
    color). Encabezado «Bitácora» con el subtítulo «Quién hizo qué y cuándo.
    Solo lectura, nadie la edita.».
  - Tabla con Cuándo (día y hora locales, el instante exacto en `<time>`),
    Usuario («Sistema» atenuado sin autor), Acción (chip con el valor de la
    API y el tono de la maqueta), Entidad con su id y Detalle. Los montos del
    detalle salen de `detalleEvento` como texto exacto, sin flotantes, y no
    se parten. Paginación de 50 con el paginador compartido.
  - Filtros por entidad, acción (valores de la API, sin traducir), usuario
    (`GET /bitacora/usuarios`) y rango de fechas en días locales; viven en la
    URL, se normalizan con `replace` y un cambio vuelve a la página 1. Con
    «Desde» posterior a «Hasta» se avisa y no se envía nada; el mismo día en
    ambos lados es un día completo.
  - El acceso denegado se distingue a simple vista: la fila lleva
    `--color-danger-row` y el chip `--color-danger-chip`, los dos tokens
    nuevos, que solo consume la tabla de la bitácora.
  - Estados de la maqueta: carga, vacío sin filtros, vacío con filtros (con
    «Restablecer filtros»), error de conexión y otro (con «Reintentar»), sin
    permiso (sin reintento) y fallo de la lista de usuarios (los eventos se
    siguen viendo). Copy fijo, nunca el texto del servidor.
  - Solo lectura: la pantalla solo hace GET y no ofrece editar ni borrar.
  - La galería `/__kit` tiene la sección «Bitácora» con las nueve vistas de la
    maqueta.
- **Unidades de CU-26.** La especificación SDD vive en engram, local del
  usuario, y no viajó a la sesión en la nube donde se hicieron U6 a U11. El
  usuario aprobó continuar con el alcance reconstruido desde U1–U5 y la
  maqueta, con tres criterios fijos: montos como texto exacto, las pruebas de
  tolerancia sin tocar y los tokens nuevos aislados. Commits de U6 en
  adelante:

  | Unidad | Rama | Commits |
  |---|---|---|
  | U6 claves y hooks | `06-claves-hooks` | `1828dc4` |
  | U7 tabla y tokens | `07-tabla` | `22de501`, `aaaa797`, `2bf387d` |
  | U8 filtros | `08-filtros` | `29125ca` |
  | U9 vacío y errores | `09-estados` | `c11162d` |
  | U10 pantalla y flujos | `10-pantalla` | `d28a7ea` |
  | U11 galería y documentos | `11-kit-docs` | `6ffa8a2` y el de estos documentos |

  - Total de CU-26 desde la integración de CU-25 (`446d9da`) hasta la galería:
    78 archivos, 6,338 líneas añadidas y 160 quitadas; del backend, 6
    archivos y 313 líneas (U1, la lista canónica de entidades y
    `GET /bitacora/usuarios`).
- **Verificación**, observada en `feat/cu-26-11-kit-docs`: en `frontend/`,
  typecheck, lint, formato, build y `verificar:dist` terminan con código 0, y
  `vitest` da 239 archivos y 3,941 pruebas en verde. Las 21 suites de
  tolerancia dan 521 pruebas, las mismas que antes de U6, y ningún archivo de
  tolerancia cambió (el usuario mencionó 574; el recuento por archivos con
  «toler» en el nombre da 521 antes y después). En la raíz, typecheck con
  código 0 y `npm test`: 38 de 39 suites y 850 de 852 pruebas en verde.
  - Esa corrida del backend se hizo en la sesión en la nube **sin Docker**:
    Postgres 16 local con una función `uuidv7()` agregada solo en
    `template1` de un clúster temporal, y Node 24 para Jest, porque
    `@nestjs/typeorm` 12 es solo ESM y Jest 30 no lo carga en Node 22. Las 2
    pruebas que fallan son las guardas de esquema que exigen Postgres 18
    (versión >= 18 y `uuid_extract_version`): fallan a propósito y confirman
    que el ajuste no se hace pasar por PG18. Ni las migraciones ni el código
    cambiaron: siguen llamando a `uuidv7()` nativo. Falta repetir la corrida
    con el Docker del usuario (Postgres 18).
- **Decisiones y notas de CU-26 (U6 a U11):**
  - Las claves de la lista llevan la época de la sesión y la consulta tal
    como se envía; la página anterior solo se conserva como provisional
    dentro de la misma época, y nunca bajo un rango invertido.
  - El texto rosado del chip de la maqueta (`#FF9AA8`) se sirve con
    `--color-danger-text`, como en Cargas y Tolerancia; por eso los tokens
    nuevos son dos. Valores claros elegidos aquí (no hay maqueta clara):
    `#fff5f6` y `#fbdde2`, con contraste mínimo de 5.02:1.
  - El chip de acción es propio de la tabla (en mono, como la maqueta) y no
    toca `EstadoChip`.
  - Un usuario de la URL que la lista no trae se conserva como opción con su
    id, para que el select no diga «Todos» mientras la consulta filtra. La
    maqueta no tiene ese caso.
  - Errores (corregido después a BIT-10, ver arriba): red y 5xx son
    conexión; 403 es sin permiso; 401 y cancelación no muestran nada; el resto,
    incluido un contrato roto, es el genérico.
  - Escaneo estático `tests/dominio/bitacoraAislamiento.test.ts`: sin
    flotantes en la feature (`Number(` solo en `fechas.ts` y `filtrosUrl.ts`,
    que no tocan montos), los tokens nuevos solo en la tabla y nada de ip,
    agente de usuario ni correo (D8).
  - La prueba del marcador de `/bitacora` en `router.test.tsx` pasó a probar
    la pantalla real. Las pruebas de la sección del kit van en
    `RutaKitBitacora.test.tsx` para no editar `RutaKit.test.tsx`.
  - Mutaciones comprobadas (rojo observado y revertido desde una copia):
    quitar la guarda de época del dato provisional, invertir la fila
    denegada, usar un token nuevo fuera de la tabla, un `parseFloat` en la
    tabla, quitar la corrección de página fuera de rango e invertir el vacío
    con filtros.
- **Pendientes abiertos de CU-26:**
  1. ~~Revisión del usuario e integración a `master`.~~ Integrado (ver arriba).
  2. **Contrastar U6 a U11 con la especificación de engram**, que no estuvo
     disponible en la sesión (claves y errores ya se contrastaron).
  3. **El enlace «Ver en la bitácora» de la tolerancia** (pendiente 2 de
     CU-25) sigue sin ponerse: cambiaría la tarjeta de cambios y sus pruebas,
     y el criterio fijo de esta entrega era no tocar las de tolerancia.
  4. ~~Correr el backend con Postgres 18~~: 852 de 852 en verde (ver arriba).
  5. **Revisión manual en el navegador**, contra `Bitacora.dc.html`: cada
     vista, los tres roles, ambos temas, 1440, 900 y 375 px, y los montos
     largos del detalle sin partirse.

- **CU-25 integrado a `master`** por avance rápido de la cadena hasta
  `feat/cu-25-09-kit-docs` (b8c57af), sin push ni PR. Sobre `master` pasan el
  typecheck de la raíz, las 3522 pruebas del frontend (218 archivos) y las 836
  del backend (39 suites, con Postgres y Redis arriba). El usuario aprobó las
  vistas de error de lectura de la versión 31 de la maqueta
  (`error_lectura_permiso` y `error_lectura_otro`) y los estados sin permiso y
  de error genérico de la tarjeta «Cambios recientes», que la maqueta no trae.
  KAN-103 pasa a Finalizado. Sigue pendiente la revisión manual en el
  navegador y los cuatro puntos abiertos de la entrada de abajo.
- **CU-25 terminado: tolerancia desde la interfaz (KAN-103).** Con ella van 25
  de 26 historias y 96 de 99 puntos; queda CU-26 (3 pts). Se integró a
  `master` el 7 oct (ver arriba). Vivía en la cadena local de ramas
  `feat/cu-25-01-logica` a `feat/cu-25-09-kit-docs`, sin push ni PR, y no toca
  el backend. Lo entregado:
  - Pantalla `/tolerancia` en lugar del marcador, con la maqueta aprobada
    (versión 31, solo oscuro; el claro sale de los mismos roles de color y del
    control de tema). Encabezado «Tolerancia de monto» con el subtítulo
    «{empresa} · aplica a movimientos y CFDI en MXN», donde la empresa es la
    activa de la sesión (cambia al cambiar de empresa).
  - Tarjeta «Valor actual» con el monto exacto, sin redondear: hasta 4
    decimales y mínimo 2 (`0.5000` se ve `0.50`, `0.0050` se ve `0.005`,
    `12.3456` se ve `12.3456`), a 88 px como la maqueta y sin partirse ni
    salirse de su caja. El valor viaja siempre como cadena y se trata solo con
    Decimal.js.
  - Formulario solo para el administrador: campo de texto con `inputMode`
    decimal (no `type="number"`), validación local en español (vacío, formato,
    más de 4 decimales, fuera de 0 a 100), aviso de «es el valor actual» y
    botón apagado mientras no haya algo válido y distinto. El `PUT` manda
    `{"toleranciaMonto":"0.0050"}` con el valor como cadena. Éxito en una
    región de estado `polite`, sin temporizador; los fallos usan copy fijo
    (400, 403, conexión y otro) y nunca el texto del servidor. Contador y
    revisor ven el valor, los cambios y el aviso «Solo un administrador de la
    empresa puede cambiar la tolerancia.», sin campo ni botón.
  - Tarjeta «Cambios recientes» con los últimos 5 cambios de la tolerancia
    (`GET /bitacora?entidad=companies&accion=actualizar&limite=50`, filtrados
    en el cliente por `datos.campo`), con su carga, vacío, error y
    «Reintentar» propios. Un cambio guardado se ve primero tras la relectura.
    Las dos lecturas son independientes: una falla sin tumbar a la otra.
  - Guarda de época: cambiar de empresa, cerrar sesión o desmontar con un `PUT`
    en vuelo no escribe caché, no invalida y no muestra nada. Al guardar con
    éxito se invalida el detalle del caso (CAS-TOL-1) para que muestre la
    tolerancia nueva; la bandeja no se toca.
  - La galería `/__kit` tiene la sección «Tolerancia» con las 15 vistas de la
    maqueta v31 (con `invalido` abierto en sus 4 motivos) y el aviso de los
    roles que solo consultan; sustituye al botón de ejemplo «Guardar
    tolerancia», que pasó a llamarse «Guardar cambios» para seguir mostrando el
    tono. Las pruebas de la galería viven en `src/app/RutaKit.test.tsx`, junto
    a las de las demás secciones (la tarea decía `features/kit`).
- **Entrega de CU-25.** Nueve ramas locales apiladas (`stacked-to-main`, `S1a`
  a `S3c`) y 17 commits en `master..HEAD` (16 de código y el de estos documentos). Se partió en límites de commit; los
  cortes que pasan de 400 líneas por las pruebas quedan como `size:exception`
  y las pruebas nunca se recortaron para entrar en el presupuesto. Tamaño real
  por rama (líneas escritas a mano, altas más bajas) y, entre paréntesis, las
  de cada commit; la previsión de la tarea era de unas 2,600 en total:

  | Rama | Líneas (previsión) | Commits | Prueba de cierre (archivos / pruebas) |
  |---|---|---|---|
  | S1a `01-logica` | 664 (~365) | `2ba56b9` (229), `c68e092` (130), `6800a1f` (305) | 202 / 3,073 |
  | S1b `02-contratos` | 1,026 (~395), `size:exception` | `2a9f2ce` (303), `a554981` (723) | 205 / 3,141 |
  | S1c `03-hooks` | 1,002 (~280), `size:exception` | `96304bd` (1,002) | 208 / 3,181 |
  | S2a `04-tarjeta-valor` | 585 (~360), `size:exception` | `ec69e2a` (585) | 211 / 3,230 |
  | S2b `05-formulario` | 1,064 (~480), `size:exception` | `6b165d6` (321), `c6445e2` (743) | 213 / 3,347 |
  | S2c `06-contenedor` | 1,146 (~420), `size:exception` | `d529573` (344), `a813a61` (138), `012ffbc` (664) | 216 / 3,405 |
  | S3a `07-cambios` | 693 (~330), `size:exception` | `4f2c0e0` (693) | 217 / 3,460 |
  | S3b `08-cambios-cableado` | 778 (~225), `size:exception` | `50303e4` (142), `b37ffa9` (636) | 218 / 3,512 |
  | S3c `09-kit-docs` | 680 (~250), `size:exception` | `4351949` (486), el de estos documentos | 218 / 3,522 |

  - Commits de más de 400 líneas: `a554981`, `96304bd`, `ec69e2a`, `c6445e2`,
    `012ffbc`, `4f2c0e0`, `b37ffa9` y `4351949`. En todos el código de
    producción cabe en 400 líneas y el exceso son las pruebas (en `4351949`,
    225 de sus 486 líneas). Los otros ocho commits, y todos los de S1a, quedan
    por debajo.
  - Total de `master` a la rama de código (antes de estos documentos): 7,347
    líneas añadidas y 35 quitadas en 64 archivos, de las cuales 1,909 son de
    código y 5,473 de pruebas y sus ayudas (manejadores de MSW, fixtures, CSS y
    contraste). La previsión era de unas 2,600 (de 2,300 a 2,900): salió casi
    tres veces mayor, y en el mismo reparto: lo que más pesó fueron las pruebas
    de hooks, componentes, CSS y flujos. Nada se recortó.
- **Verificación de S3c**, observada en `feat/cu-25-09-kit-docs`: en
  `frontend/`, typecheck, lint (sin modificar), formato, build y
  `verificar:dist` terminan con código 0; dos corridas completas de `vitest` en
  paralelo (cada una con su `TMPDIR`) dan 218 archivos y 3,522 pruebas en
  verde, 10 más que en S3b, sin fallos. En la raíz, typecheck con código 0 y
  `npm test` con Postgres y Redis arriba: 39 suites y 836 pruebas en verde
  (las trazas `ERROR` y `WARN` del registro son de pruebas que provocan el
  fallo a propósito). `git diff --stat master` no muestra ningún cambio en
  el backend (`src/`), ninguna migración ni ningún GRANT: todo lo cambiado
  está en `frontend/`, más `CUADRA.md` y esta bitácora.
- **Decisiones de CU-25** (aceptadas por el usuario): la pantalla acepta hasta
  4 decimales, como el servidor, y muestra el valor sin ceros de más pero con
  mínimo 2 (Q1); los últimos 5 cambios salen de `GET /bitacora` filtrados en el
  cliente, y el enlace «Ver en la bitácora» no se muestra hasta que exista
  CU-26 (Q2); el éxito es un mensaje en línea en una región `polite`, que dura
  hasta editar o salir, sin aviso emergente (Q3); Guardar se apaga mientras el
  valor escrito sea igual al vigente, comparado como Decimal (Q4); contador y
  revisor ven lo mismo, con el aviso y sin formulario (Q5); campo de texto con
  `inputMode` decimal en lugar de `type="number"` (Q6); un 400 del servidor
  muestra copy fijo, nunca su frase (Q7); el subtítulo lleva el nombre de la
  empresa activa, dinámico, y reemplaza al subtítulo estático del diseño (Q8);
  un valor negativo como «-1» es error de rango y no de formato, y eso anula lo
  que decía TOL-4.2 de la especificación (Q9).
- **Desvíos y notas registrados durante la entrega:**
  - Subtítulo dinámico (Q8): `ManejadorRuta` ganó `subtituloConEmpresa` y
    `tituloDocumento`; el título del documento sigue siendo «Tolerancia ·
    Cuadra» mientras el `h1` es «Tolerancia de monto». Los subtítulos estáticos
    de las demás rutas no cambian.
  - Negativos (Q9): `-1`, `-0`, `-0.5` y `-0.12345` son error de rango; el
    orden de validación es vacío, formato, negativo, más de 4 decimales y más
    de 100.
  - El formateador exacto vive en `shared/dinero` (no en la tarjeta) y no usa
    nunca el formateador de 2 decimales. No se usó `Campo`: el formulario lleva
    su propio marcado (ADR-3). La consulta de cambios pide `limite=50` y se
    queda con 5.
  - El cliente de API no tenía `PUT`: `OpcionesApi.method` se amplió a
    `GET | POST | PUT` (el diseño lo pasó por alto) con su prueba.
  - Tras guardar, el campo vuelve a seguir a la caché y la ayuda es la normal,
    no «Es el valor actual» (maqueta y diseño; el texto de TOL-6 decía lo
    contrario).
  - `vistaValor` clasifica con el clasificador de errores de guardado y no con
    el de lectura de cargas, porque ese manda los 5xx a «conexión» y TOL-2.4
    pide el copy genérico.
  - Desmontar con un `PUT` en vuelo (TOL-9.9): no se llama a la pantalla ni
    hay error, pero la escritura de caché y la invalidación del hook corren
    igual en la misma época, porque el servidor sí guardó.
  - Lectura de la versión 31 de la maqueta: el `PUT` 400 es una sola frase en
    `AlertaError` (título en negrita; la maqueta la pone en peso normal) y el
    éxito usa `--estado-conciliado-text`.
  - Interpretaciones de S3b: las aserciones de valor se acotan a la tarjeta
    «Valor actual» (con la lista, `$0.50` aparece también en las filas;
    con el ayudante `src/test/tarjetaValor.ts`); CAS-TOL-1.1 y CAS-TOL-1.3 se prueban en
    el flujo solo hasta donde se puede (el cliente de la app tiene `staleTime`
    0, así que reabrir un caso siempre relee, y una consulta inactiva nunca se
    relee por invalidación): lo que discrimina `isInvalidated` es la prueba del
    hook de S1c; el reintento de TOL-10.9 se prueba a nivel de contenedor con
    el cliente sin reintentos, porque el de la app reintenta red y 5xx (R7).
  - Mutaciones comprobadas en cada unidad (rojo observado y revertido desde una
    copia de respaldo, nunca con `git checkout`): entre otras, quitar la clave
    de época de `TolerPage`, quitar `cancelQueries`, la guarda de época o la de
    envío único del hook, apagar el candado de envío del formulario, un
    literal de rol o `Number(` en el código de producción, y el `Reintentar`
    de la tarjeta de cambios atado a la lectura del valor.
  - Contraste: todos los pares nuevos pasan en ambos temas (el más bajo, 5.05:1
    en oscuro y 4.85:1 en claro para texto; `danger` contra el campo, 7.02 y
    5.34 como no texto). Ningún color se cambió para pasarlo.
- **Riesgos aceptados.** Reintentos del cliente de la app (red y 5xx, con
  retroceso) hacen que los fallos de lectura se prueben a nivel de contenedor.
  Las pruebas de otras pantallas que aterrizan en `/tolerancia` ahora dependen
  de los manejadores por defecto (solo se adaptaron dos pruebas de
  `router.test.tsx`, cada una probada con una corrida que falla). Las pruebas
  de tolerancia reutilizan `useEpocaVigente`, `clasificarErrorLectura` y
  `esperarIntervalos` de cargas (ver pendiente 3).
- **Pendientes abiertos de CU-25:**
  1. **Backend: `PUT /empresa/tolerancia` idempotente.** Comparar el valor
     nuevo con el vigente dentro de la misma transacción, con bloqueo de fila
     (`SELECT ... FOR UPDATE`); si son iguales no se escribe ninguna fila de
     bitácora y se responde 200 con el valor vigente. Hoy la pantalla lo evita
     apagando Guardar, pero el servidor registraría un cambio sin cambio.
  2. **Restaurar el enlace «Ver en la bitácora»** con el filtro de tolerancia
     ya puesto, cuando exista CU-26.
  3. **Subir a `shared` los ayudantes de cargas** que reutiliza tolerancia:
     `useEpocaVigente`, `clasificarErrorLectura` y `esperarIntervalos`.
  4. **Contraste del borde de los campos en toda la app**: `--color-border-strong`
     contra `--color-inset` da 1.57:1 en oscuro y 1.48:1 en claro, por debajo
     de 3:1 para elementos no textuales (lo comparten `Campo` y el formulario de
     tolerancia). No se corrigió en CU-25.
- **Aprobado por el usuario al integrar** (antes pendiente): de la versión 31 de la
  maqueta, las vistas de error de lectura `error_lectura_permiso` y
  `error_lectura_otro` (ya construidas, en S2a); y los estados de la tarjeta
  «Cambios recientes» sin permiso y de error genérico, que exige la
  especificación (TOL-10) pero que la maqueta no trae (la tarjeta los muestra
  con el copy compartido).
- **Revisión manual en el navegador: PENDIENTE.** Nadie la corrió; las pruebas
  automáticas no la sustituyen. Contra la maqueta aprobada (versión 31), con el
  API de desarrollo y datos sembrados; los servidores que se arranquen se
  detienen por PID:
  - [ ] Cada `vista` (`normal`, `cargando`, `error_lectura`,
    `error_lectura_permiso`, `error_lectura_otro`, `sin_cambios`, `invalido`
    con sus 4 motivos, `guardando`, `guardado`, `error_400`, `error_403`,
    `error_conexion`, `error_otro`, `cambios_vacio`, `cambios_error`) y cada
    rol (administrador, contador, revisor), en oscuro y en claro (el claro con
    el control de tema del shell, porque no hay maqueta clara), a 1440, 900 y
    375 px.
  - [ ] El monto de 88 px con 4 decimales y con `100.00`, sin salirse de su
    caja ni partirse.
  - [ ] Valores inválidos escritos a mano: coma, 5 decimales, `100.5` y vacío.
  - [ ] El aviso de «es el valor actual».
  - [ ] Guardado real contra el API de desarrollo con `0.0050`, `1.2340`,
    `100` y `0`, con la tarjeta del valor y el detalle del caso mostrándolo.
  - [ ] La fila de la bitácora visible en «Cambios recientes» tras guardar.
  - [ ] 403 con un rol degradado.
  - [ ] Guardar sin red conserva el borrador.
  - [ ] Cambio de empresa con un borrador sin guardar.
  - [ ] El control de tema dentro de la propia pantalla.
  - [ ] Solo teclado y lector de pantalla: anuncios de la región de estado y
    foco en la alerta.
  - [ ] El subtítulo con el nombre de la empresa activa, antes y después de
    cambiar de empresa.
- **Seguimiento de CU-24 integrado a `master`** por avance rápido de
  `fix/cu-24-seguimientos` (6 commits: comentarios de M7, bandeja invalidada
  una vez por transición, reencolado de una carga fallida y maqueta v27), sin
  push ni PR. Sobre `master` pasan el typecheck de la raíz, las 2968 pruebas
  del frontend y las 836 del backend (39 suites). Sin pendientes abiertos de
  CU-24 salvo la prueba manual de una subida real en el navegador, que debe
  incluir resubir un archivo cuya carga falló y ver que la bandeja se
  actualiza al terminar.
- **Reencolado y maqueta v27 de cargas, en `fix/cu-24-seguimientos`** (local,
  sin push ni PR). Dos commits de código:
  - Error en el aviso a la bandeja: la deduplicación de la doble invalidación
    guardaba `época:id` sin vaciarlo nunca, bajo la suposición de que una carga
    terminada no vuelve a estar activa. Es falso: resubir un archivo `fallida`
    la reencola a `pendiente` (el POST responde 200 con `yaExistia`), y su
    siguiente cierre ya no invalidaba la bandeja, así que las coincidencias
    nuevas no aparecían. Ahora `usePollingCargas` olvida el aviso al ver la
    carga activa otra vez; la dedupe es por transición (un solo aviso si ambos
    observadores ven la misma, nada en otra época). Al resubir, el contenedor
    también descarta el detalle en caché de la corrida anterior, que seguía
    mostrando «Fallida» y detenía el sondeo. El mock de MSW reencola como el
    backend. Rojo observado primero: la prueba del hook esperaba 2
    invalidaciones y recibió 1, el flujo esperaba 3 lecturas del resumen y
    recibió 2. Verde después.
  - Maqueta v27 aprobada e implementada: la carga fallida muestra el chip
    «Fallida» sobre el aviso fijo; un `ya existía` ya terminado muestra su
    resultado (resumen y lista) debajo del aviso, tomado del cuerpo del POST,
    sin pedir `GET /cargas/:id`; reencolado sigue con aviso, «Procesando la
    carga…» y el resultado al terminar. `errorMensaje` no se muestra a
    propósito: el backend escribe siempre un mensaje fijo y repetiría el aviso.
    Revierte esa parte de e0d2352 (la vista `solo_aviso` desapareció). La
    galería del kit y sus pruebas siguen la maqueta. Cierra el pendiente de la
    maqueta de las entradas de abajo.
  - Con ambos: typecheck, lint, formato, build y `verificar:dist` del frontend
    en verde, typecheck de la raíz y 2968 pruebas del frontend (dos corridas
    paralelas). Sin cambio de backend.
- **Seguimientos de CU-24, en `fix/cu-24-seguimientos`** (local, sin push ni
  PR). Dos commits de código:
  - M7: los comentarios de `carga.entity.ts`, `estado-cuenta.dto.ts` y
    `movimiento.entity.ts` decían que la cuenta se guarda enmascarada. No es
    así: el servidor la guarda tal como llega (`cargas.cuenta` y su copia en
    `movimientos.cuenta`); el cliente solo pide los últimos dígitos y el
    servidor no la enmascara ni la valida. Solo comentarios, sin cambio de
    comportamiento, validación, migración ni ejemplo de OpenAPI.
  - Doble invalidación: cuando una carga sondeada pasaba de activa a terminal,
    la lista y el panel la veían y cada uno invalidaba `['bandeja', época]`, con
    dos `GET /bandeja/resumen` de más. Ahora `usePollingCargas` invalida una
    vez por carga y época; si solo la ve un observador, invalida igual, y otra
    época no invalida nada (M17 intacto). Rojo observado primero: la prueba de
    flujo esperaba 1 lectura y recibió 2 (3 contra 2 acumuladas), y la nueva del
    hook recibió 2 invalidaciones en vez de 1. Verde después.
  - Con ambos: typecheck, lint, formato, build y `verificar:dist` del frontend
    en verde; 2969 pruebas del frontend (dos corridas paralelas) y 836 del
    backend (39 suites, con Postgres y Redis arriba). Sigue abierto lo de la
    maqueta (etiqueta «Fallida», mensaje del servidor y resultados bajo «ya
    existía»).
- **CU-24 integrado a `master`** por avance rápido de la cadena hasta
  `feat/cu-24-09-kit-docs`, sin push ni PR. Sobre `master` pasan el typecheck
  de la raíz, las 2966 pruebas del frontend y las 836 del backend (39 suites,
  con Postgres y Redis arriba). El usuario recorrió la pantalla en el navegador
  y la dio por buena; falta probar una subida real de archivos. Siguen
  abiertos: agregar a la maqueta la etiqueta «Fallida», el mensaje del
  servidor y los resultados bajo «ya existía». El seguimiento M7 y la doble
  invalidación de la bandeja quedaron resueltos (ver la entrada de arriba).
- **CU-24 terminado: cargas desde la interfaz (KAN-102).** Con ella van 24 de
  26 historias y 94 de 99 puntos; quedan CU-25 y CU-26 (5 pts). Se integró a
  `master` el 7 oct (ver arriba). Vivía en la cadena local de ramas
  `feat/cu-24-00-api-cargas` a `feat/cu-24-09-kit-docs`. Lo entregado:
  - API: `GET /cargas`, solo lectura y sin migración. Devuelve `{datos: [...]}`
    con las últimas 20 cargas de la empresa, de la más nueva a la más antigua
    (empate por `id`), con el nombre de quien subió (o `null`). Filtra por
    `company_id` y la puede leer cualquier rol.
  - Pantalla `/cargas` en lugar del marcador, con la maqueta aprobada (versión
    25, solo oscuro; el claro sale de los mismos roles de color y del control
    de tema). Dos tarjetas de subida: CFDI (varios `.xml`, hasta 500 archivos,
    2 MB cada uno y 50 MB en total) y estado de cuenta (un `.csv` de hasta
    10 MB, con banco, cuenta y perfil de lectura). La validación local es una
    comodidad y el servidor decide. Cada subida abre un panel de resultado en
    su tarjeta: por archivo (CFDI), por fila con error (CSV), «Procesando la
    carga…», la falla fija del mockup y el aviso de «ya existía» (K7). El
    historial «Cargas recientes» muestra la tabla con la barra «Avance»
    derivada solo del estado, sin porcentajes, y sus estados de carga, vacío,
    error y sin permiso.
  - Sondeo cada 3 s mientras haya una carga pendiente o procesando, con tope de
    5 min; al vencer aparece «Actualizar» y el sondeo se reabre. Un solo
    observador alimenta el historial y las tarjetas. Al pasar una carga de
    activa a terminal se invalidan también los datos de la bandeja (M17).
  - El cliente de API ganó la rama `FormData` (sin `Content-Type` propio, sin
    serializar el cuerpo) y un clasificador de errores de subida: 400 con el
    motivo del servidor como texto plano, 413, 403, conexión y fallo
    inesperado. Nada de lo que manda el servidor se pinta como marcado.
  - La galería `/__kit` tiene la sección «Cargas» con 22 de las 23 vistas de la
    maqueta, el historial sin permiso y las filas rechazadas. Falta
    `arrastrando`: es el estado interno de la zona de soltar y solo lo produce
    un arrastre real; la cubren las pruebas de `ZonaSoltar`, no la galería. El
    tope de cantidad y el de total se muestran con dos entradas ya evaluadas
    (500 filas aceptadas llenarían la galería sin enseñar nada nuevo).
- **Entrega de CU-24.** Diez ramas locales apiladas (`stacked-to-main`, `S0` a
  `S9`) y 37 commits en `master..HEAD` (35 hasta S8, el del kit y el de estos
  documentos, que es el último). Se partió en límites de commit y los cortes que
  pasan de 400 líneas por las pruebas quedan como `size:exception`; las
  pruebas nunca se recortaron para entrar en el presupuesto. Tamaño real por
  rama contra la anterior (`git diff --shortstat`, líneas escritas a mano, sin
  archivos generados) y, entre paréntesis, las líneas de cada commit
  (altas más bajas, que pueden sumar más que la rama cuando un commit reescribe
  lo anterior):

  | Rama | Tamaño de la rama | Commits | Prueba de cierre |
  |---|---|---|---|
  | S0 `00-api-cargas` | 540+/2-, 4 archivos | `a4ad69b` (542) | typecheck y Jest de la raíz; sin conteo anotado |
  | S1 `01-contratos` | 1,668+/3-, 14 archivos | `425c0e5` (495), `2fd6aca` (1,176) | 2,356 en verde y 5 omitidas |
  | S2 `02-cliente` | 518+/9-, 9 archivos | `6f82f01` (100), `4e765b4` (135), `fe24e0d` (292) | 2,386 |
  | S3 `03-datos` | 1,564+, 17 archivos | `b97b5f5` (1,058), `4d3eb68` (385), `441ecfa` (4), `2f35a56` (197) | 2,450 |
  | S4 `04-historial` | 1,493+/3-, 34 archivos | `c146288` (372), `3408bd8` (323), `0860d0a` (780), `3ff984a` (47) | 2,567 |
  | S5 `05-tarjetas` | 3,395+/2-, 42 archivos | `cfab0f8` (340), `fb55596` (740), `46c5308` (605), `de90b57` (921), `a15cff6` (533), `c38840e` (302) | 2,737 |
  | S6 `06-resultados` | 1,886+/49-, 31 archivos | `971e440` (206), `dbc430e` (479), `41989ba` (296), `a1521c5` (315), `2a1b6e1` (213), `f616e90` (402), `e0d2352` (218) | 2,836 |
  | S7 `07-errores` | 1,169+/18-, 22 archivos | `5a567c9` (179), `6247c6b` (341), `b7e6c5e` (412), `007a632` (232), `93b10bc` (51) | 2,906 |
  | S8 `08-pagina` | 1,084+/62-, 11 archivos | `9276aef` (111), `e246038` (586), `f16c147` (449) | 2,951 |
  | S9 `09-kit-docs` | 739+, 4 archivos, más estos documentos | `9f23912` (739: 453 de código y 286 de pruebas) | 2,966 |

  - Commits de más de 400 líneas: `a4ad69b`, `425c0e5`, `2fd6aca`, `b97b5f5`,
    `0860d0a`, `fb55596`, `46c5308`, `de90b57`, `a15cff6`, `dbc430e`,
    `f616e90`, `b7e6c5e`, `e246038`, `f16c147` y `9f23912`. En todos menos el
    último el código de producción cabe en 400 líneas (el mayor, 397) y el
    exceso son las pruebas, entre el 41 % y el 100 % de cada commit.
    `9f23912` es la excepción: sus 453 líneas de código ya pasan de 400, de las
    cuales 432 son la propia sección del kit (datos de ejemplo y 23 bloques);
    no se partió porque es una galería que se lee de una vez.
  - Total de `master` a la rama del kit: 13,927 líneas añadidas y 19 quitadas
    en 146 archivos, de las cuales 4,726 son de código y 9,201 de pruebas
    y sus ayudas (incluidas las de CSS y contraste). La previsión era de unas 3,400 (de
    3,000 a 4,300): salió unas cuatro veces mayor. El backend pesó lo previsto
    (unas 540); el resto es frontend, donde las pruebas de hooks, componentes,
    contraste y flujos pesaron mucho más que el cálculo. S1 a S9 se
    cerraron con typecheck, lint, formato, build y `verificar:dist` en 0, el
    typecheck de la raíz en 0 y dos corridas completas de `vitest` en paralelo
    sin fallos; S0 se cerró con el typecheck y el Jest de la raíz.
- **Verificación de S9**, observada en `feat/cu-24-09-kit-docs`: en
  `frontend/`, typecheck, lint, formato, build y `verificar:dist` terminan con
  código 0; dos corridas completas de `vitest` en paralelo (cada una con su
  `TMPDIR`) dan 198 archivos y 2,966 pruebas en verde, 15 más que en S8. En la
  raíz, typecheck con código 0. No se volvió a correr `npm test` de la raíz:
  el backend no cambia desde S0.
- **Decisiones de CU-24** (aceptadas por el usuario): se agrega `GET /cargas`
  (1); no hay maqueta clara, el tema claro sale de los roles de color y del
  control de tema (2); «Avance» solo por estado, sin porcentajes (3); el motivo
  de cada archivo, de cada fila y del 400 se muestra como texto plano (4); el
  revisor ve la tabla y las tarjetas quedan apagadas con una explicación (5);
  sin progreso en bytes, el botón dice «Subiendo…» (6); sondeo de 3 s con tope
  de 5 min y «Actualizar» (7); la cuenta lleva el marcador `****1234` y un
  aviso que no bloquea (8); últimas 20 cargas, sin paginar y con fecha (9); sin
  detalle por fila del historial (10). Correcciones del orquestador a la
  propuesta: K1 a K7 (cinco estados, columnas del mockup más Fecha, botones del
  mockup, el aviso de cuenta no promete enmascarar, «Actualizar» solo tras el
  tope, barra llena con el color del estado y el texto de «ya existía» según el
  estado devuelto). Enmiendas a la especificación M1 a M19 (más M20, la
  aprobación de la versión 23 de la maqueta), guardadas en Engram como
  `sdd/cu-24-cargas/spec-amendments`; M7 no se tocó (ver pendientes).
- **Cambios por decisión del usuario sobre el mockup** (la pantalla sigue al
  mockup, aun contra la especificación):
  - Una carga `fallida` muestra «—» en Válidos y en Con error, sin resaltar
    (decisión 187; enmienda de M12; `3ff984a`).
  - Si fallan los perfiles, el campo «Perfil de lectura» sigue visible pero
    apagado, con «No se pudieron cargar los perfiles.» y «Reintentar» (decisión
    188; reemplaza lo previsto en la tarea 5.3, que lo ocultaba; `c38840e`).
  - Los paneles de resultado se recortan al mockup (decisión 189; se aparta de
    CRG-8.4 y CRG-8.6): la carga fallida muestra solo la caja de aviso fija,
    sin la etiqueta «Fallida» ni el `errorMensaje`; un «ya existía» que ya
    había terminado muestra solo el aviso, sin resultados (`e0d2352`).
  - El mockup recibió la vista `error_otro` (versión 25) para el fallo
    inesperado al subir, y se implementó: «No se pudo completar la solicitud.»,
    la selección se conserva y no hay «Reintentar» (decisión 190; `93b10bc`).
- **Resultado del experimento de `FormData` en jsdom (S2).** Falló tal como se
  temía: undici exige que el cuerpo sea un `FormData` y un `File` nativos y
  rechazaba los de jsdom (el servidor de pruebas respondía 500). Se restauraron
  `Blob`, `File` y `FormData` nativos en `frontend/src/test/setup.ts`
  (`node:buffer` para `File` y `Blob`, y el `FormData` de una `Response`
  nativa), instalados con `Object.defineProperty` porque la asignación simple
  rompía la `Request` de compatibilidad de Vitest. `userEvent.upload` sigue
  funcionando con archivos nativos. La prueba se conserva en
  `src/shared/api/formdata.test.tsx` (`6f82f01`), y las 5 pruebas multipart
  que S1 dejó omitidas pasaron a activas y en verde.
- **Corrección de pruebas en S3 (`2f35a56`).** Las pruebas del sondeo usaban
  una espera fija de milisegundos (`esperar(ms)`) para demostrar que el sondeo
  se detiene. Se reemplazó en 17 sitios por un testigo de intervalos
  independiente (`esperarIntervalos`, con al menos 3 ticks medidos contra el
  reloj) y controles positivos. Se comprobó con mutaciones, revertidas: ignorar
  el tope hace fallar la prueba del tope, seguir sondeando filas terminadas
  hace fallar cuatro, y `refetchIntervalInBackground` hace fallar la de la
  pestaña oculta. Antes, `441ecfa` cambió un conteo exacto de sondeos (igual a 3)
  por «al menos 3»: había fallado en una de las primeras corridas en paralelo.
- **Riesgos aceptados.** El sondeo cuenta también el tiempo con la pestaña
  oculta y una subida nueva abre otra ventana de 5 min; un servidor caído se
  sondea cada 3 s hasta el tope, sin retroceso. Si falla la lectura del panel,
  se queda el último dato hasta el tope. Un CSV con miles de filas con error se
  pinta completo en una región con desplazamiento, sin ventanas virtuales. Un
  CSV de 10 a 11 MB da 400 y de más de 11 MB da 413; se clasifica por estado.
  Las pruebas que aterrizan en `/cargas` ahora hacen peticiones y dependen de
  los manejadores por defecto (se adaptaron `router.test.tsx` y dos
  afirmaciones del contenedor y de la página, cada una probada con una corrida
  que falla).
- **Pendientes de CU-24:**
  - **Integrar la cadena a `master`**: avance rápido hasta
    `feat/cu-24-09-kit-docs`, o por rama, a decisión del usuario. Nada se
    empujó ni se abrió como PR.
  - **M7**: ni la entidad ni el DTO enmascaran `cuenta`, pero sus comentarios
    dicen «enmascarada». Corregirlos queda fuera de CU-24 hasta que el usuario
    lo pida.
  - **Adiciones al mockup sin aprobar**, hoy fuera de la pantalla: la etiqueta
    «Fallida» y el `errorMensaje` de una carga fallida, y los resultados bajo
    un «ya existía» que ya había terminado. Relacionado: un «ya existía» que se
    vuelve a poner en la cola y luego termina sí muestra sus resultados tras el
    sondeo, y eso no está en el mockup (las dos situaciones esperan el
    mismo acuerdo).
  - **Doble invalidación de la bandeja (M17)**: la lista y el panel observan la
    misma transición de activa a terminal, así que se piden 2 veces
    `GET /bandeja/resumen` de más. Es inofensivo y una prueba lo fija; no se
    cambió.
  - **Monto de la galería con «0123456789»**: el monto de ejemplo
    `12345678901234567890.12` de `KitPage.tsx` contiene esa secuencia. Es previo
    a CU-24 y queda fuera de `features/cargas`, donde la prueba de CRG-6 busca.
- **Revisión manual en el navegador: PARCIAL.** El 7 oct el usuario recorrió
  la pantalla y la dio por buena; falta una subida real de archivos y el resto
  de esta lista. Las pruebas automáticas no la sustituyen. Contra la maqueta aprobada (versión 25), con el API de desarrollo
  y datos sembrados, y los servidores que se arranquen se detienen por PID:
  - [ ] Cada `vista` en oscuro y en claro (el claro con el control de tema de
    la propia pantalla, porque no hay maqueta clara), a 1440, 900 y 375 px.
  - [ ] Revisor: tarjetas apagadas y aviso, con la tabla visible.
  - [ ] Subiendo: botón «Subiendo…», lista atenuada, la otra tarjeta disponible.
  - [ ] Sondeo a la vista: «Avance» indeterminado y, con «reducir movimiento»,
    sin animación.
  - [ ] Tope y «Actualizar» tras 5 minutos (o con una ventana corta de
    desarrollo), en la cabecera y dentro de la tarjeta.
  - [ ] Resultados con cientos de archivos o de filas: desplazamiento, sin
    recortes.
  - [ ] 400 y 413 con subidas reales: más de 50 MB y una extensión incorrecta;
    un CSV de entre 10 y 11 MB (400) y otro de más de 11 MB (413).
  - [ ] Cuenta: el aviso al escribir un número completo, sin bloquear.
  - [ ] Pestaña oculta: el sondeo se pausa y se reanuda al volver.
  - [ ] Los contadores y los montos no se parten ni se salen de su caja.
  - [ ] Solo teclado: elegir archivos, quitar rechazados, subir y leer los
    resultados; foco visible y objetivos de al menos 44 px.
  - [ ] Revisión con lector de pantalla: aviso al subir, resultado y alertas.
  - [ ] `GET /cargas` real contra el API de desarrollo con datos sembrados.

### 6 oct 2026

- **CU-23 integrado a `master`** por avance rápido de la cadena hasta
  `feat/cu-23-11-ajustes-verificacion` (incluye las ramas 10, pruebas bajo
  carga, y 11, ajustes de la verificación: valores del dominio tipados desde
  el espejo con escaneo de literales y la guarda de inyección restaurada),
  sin push ni PR. KAN-101 pasa a Finalizado. Con CU-22 y CU-23 la épica G
  queda completa: 23 de 26 historias y 89 de 99 puntos; KAN-105 pasa a
  Finalizado. El usuario probó el detalle del caso en el navegador y quedó
  correcto. Arranca la épica H (KAN-106) con CU-24 (KAN-102).
- **Comprobación en vivo de `GET /casos/:movimientoId`** contra el API de
  desarrollo (el contenedor recargó solo con `--watch`), con un usuario de la
  demo en Ferretería: un caso de la bandeja responde 200 con estado
  `sugerencia`, montos y `score` como cadenas decimales, `origen` y la
  tolerancia de la empresa; un UUID ajeno da 404, un id que no es UUID da 400
  y sin token da 401.

### 5 oct 2026

- **CU-23 terminado: detalle y resolución de un caso en pantalla (KAN-101).**
  Se integró a `master` el 6 oct (ver arriba). Vivía en la cadena local de
  ramas `feat/cu-23-00-api-caso` a `feat/cu-23-09-kit-docs`. Con ella van 23 de
  26 historias y 89 de 99 puntos; quedan CU-24 a CU-26 (10 pts) y la épica H.
  Lo entregado:
  - API: `GET /casos/:movimientoId`, solo lectura y sin migración. Una sola
    sentencia SQL (movimiento, tolerancia de la empresa, propuestas vigentes o
    la confirmada, CFDI y nombre de quien confirmó), filtrada por `company_id`
    en cada tabla de dominio y con RLS. Un id inexistente y uno de otra
    empresa dan el mismo 404; un id que no es UUID da 400. Las propuestas van
    en el mismo orden que usa la bandeja para su mejor propuesta, y todo monto
    y el `score` salen como cadenas decimales. Está documentada en Swagger.
  - Pantalla `/casos/:movimientoId` en lugar del marcador, con las 14 `vista`
    de la maqueta aprobada (versión 20, claro y oscuro): sugerencia, varias,
    sin match, conciliado, cargando, error, no encontrado, contrato, enviando,
    conflicto, sin permiso, motivo largo, confirmado y rechazado. Movimiento,
    CFDI y diferencia con su nota de tolerancia, motivo del motor con la
    insignia de IA, lista de propuestas colapsadas, «Tu decisión» en línea
    (confirmar con un clic; rechazar con motivo opcional y contador
    `{n} / 500`), historial de la propuesta mostrada y banners tras resolver.
    El cliente no decide nada: confirmar y rechazar son llamadas a la API y el
    estado, la regla y los permisos salen del servidor y del espejo del
    dominio.
  - Tras confirmar o rechazar se invalidan los prefijos `['caso', época]` y
    `['bandeja', época]`: el caso, el historial, la bandeja y el contador de la
    barra lateral se refrescan (una sola petición más a `/bandeja/resumen`).
    Una resolución que termina después de cambiar de empresa o de cerrar
    sesión no escribe ni muestra nada en la época nueva.
  - La galería `/__kit` tiene la sección «Caso» con las 14 vistas y las tres
    formas del historial (con eventos, vacío y con error).
- **Entrega de CU-23.** Diez ramas locales apiladas (`stacked-to-main`) más
  una rama por tramo de commits (`feat/cu-23-02a-hooks`, `-03a-helpers`,
  `-03b-componentes`, `-04a-ajustes-cfdi`, `-04b-tarjetas`, `-05a-motivo`,
  `-05b-panel`, `-06a-componentes`, `-07a-banner`, `-08a-contenedor` y
  `-09a-kit`). Se partió en límites de commit; los cortes que pasan de 400
  líneas por las pruebas quedan como `size:exception` (S0 a S8, en todos más
  de la mitad son pruebas; el segundo commit de S9, de 448 líneas, pasa por
  poco y es en buena parte la sección del kit con su prueba). Tamaño real por rama,
  contra la anterior (`git diff --shortstat`): S0 (781+, 7 archivos, un
  commit), S1 (958+/2-), S2 (1,500+/14-), S3 (2,216+/19-, en tres commits de
  430, 1,501 y 285 líneas), S4 (1,160+/77-), S5 (944+/23-), S6 (930+/30-),
  S7 (896+/17-), S8 (513+, en dos commits de 170 y 343 líneas: pruebas de
  estructura y flujos de `montarApp`; sin cambios de producción) y S9 (467+/1-
  de código, en dos commits de 19 y 448 líneas, más estos documentos). Total
  cercano a 10,400 líneas, contra las 3,600 previstas: la estimación quedó corta
  porque el trabajo de pruebas (contratos, hooks, componentes, flujos) pesó más
  de lo calculado.
- **Verificación de CU-23**, observada en `feat/cu-23-09-kit-docs`: en
  `frontend/`, 144 archivos y 2,287 pruebas en verde; typecheck, lint, formato,
  build y `verificar:dist` limpios. En la raíz, typecheck limpio y, con
  Postgres y Redis activos, 38 suites con 820 pruebas del backend en verde.
  Lint de la raíz: un error y una advertencia que ya existen en `master` y que
  esta historia no toca (ver pendientes).
- **Pruebas intermitentes bajo carga (6 oct), rama
  `feat/cu-23-10-tiempos-pruebas`.** Con la máquina cargada (carga media de 18
  a 25 en 12 núcleos), la suite con dos corridas en paralelo fallaba de 9 a 23
  pruebas por corrida. `master` fallaba igual (8 a 11, las mismas pruebas), así
  que no lo introdujo CU-23. Causas y arreglos, ninguno en código de
  producción:
  - `router.navigate` fuera de `act`: el enrutador aplica la navegación en
    una transición de React y el sondeo de `waitFor` con `getByText` la dejaba
    sin turno hasta agotar el tiempo (se vio con sondas). Ahora las
    navegaciones de las pruebas van dentro de `act` (40df486, e33d7ab).
  - Retrasos fijos de 80 ms para mirar el estado en vuelo o el cambio de
    época: la respuesta se retiene a mano y se espera a que la mutación
    termine (e33d7ab).
  - Dos flujos de sesión empezaban a espiar peticiones antes de que la bandeja
    terminara su carga inicial; ahora la esperan. La galería `/__kit`, que se
    importa diferida, tiene su propio margen de 10 s (c79b52f).
  - Flujos que montan la app completa: de 1.5 a 2.6 s aislados con la máquina
    cargada; el límite por prueba sube a 15 s y la espera de `findBy` y
    `waitFor` a 3 s (ac823b6). Un cuelgue real sigue fallando.
  - Resultado: 8 corridas (cuatro rondas de dos suites en paralelo) con las
    2,287 pruebas en verde, con la máquina igual de cargada.
- **Decisiones de CU-23** (D-01 a D-09, aceptadas por el usuario): un agregado
  nuevo `GET /casos/:movimientoId` con pruebas de integración (D-01); el rol
  revisor puede confirmar y rechazar, como permite el backend, sin aviso de
  solo lectura y con D-08 aplicada por el servidor en cada acción (D-02); se
  listan todas las propuestas vigentes con la advertencia de que confirmar una
  rechaza las demás (D-03); `sin_match` y `conciliado` son de solo lectura
  (D-04); confirmar es un clic, con estado de envío y manejo del 409 (D-05);
  tras resolver se muestra un banner armado con la respuesta del servidor, la
  página queda de solo lectura y no navega (D-06); se elimina la línea de
  banco, cuenta y perfil del encabezado (D-07); el historial muestra solo
  eventos de conciliación (D-08 de ese documento); los textos y la maqueta se
  aprueban antes de la primera pantalla (D-09). Correcciones al texto de la
  propuesta: motivo de rechazo opcional (C1), sin diálogo, el motivo va en
  línea (C2), texto de D-08 «Quien subió el CFDI o el estado de cuenta no puede
  confirmarlo» (C3), se conserva el texto que ya tiene la maqueta (C4) y el 409
  solo recarga al hacer clic (C5). Después se agregó el singular «Queda 1
  propuesta vigente para este movimiento.» (R3/B11).
- **Enmiendas a la especificación** (B1 a B15, guardadas en Engram como
  `sdd/cu-23-detalle-caso/spec-amendments`): la prueba de precisión del backend
  usa `99999999999999.9999`, el máximo de `numeric(18,4)` (B1); hay un solo
  `h1` en la página, el del shell, y la descripción del movimiento es un `h2`
  (B2); la propuesta lleva `origen` (`regla`, `llm` o `manual`) porque la
  maqueta lo muestra (B3); la maqueta manda en textos y distribución, con la
  regla en las filas colapsadas y el historial solo con acción, actor y hora
  (B4); tras rechazar la última propuesta, el historial es el de la rechazada,
  tomado de la respuesta del POST (B5); API-14 se reduce al espejo de
  `MOTIVO_MAXIMO`, su prueba de deriva y los mapas de etiquetas (B6); la ruta
  pasa de `/casos/:id` a `/casos/:movimientoId` y `users` se alcanza por la
  conciliación filtrada por empresa, porque no tiene `company_id` (B7); el
  contador muestra el largo bruto y la validación usa el recortado (B8); el
  caso desactualizado (la relectura falla tras resolver) no tiene pantalla
  nueva: reutiliza la alerta de conectividad aprobada bajo el banner, con los
  controles bloqueados (B9); riesgos aceptados: un 403 por pérdida de
  membresía se muestra con el texto de D-08 y un movimiento descartado abierto
  por URL muestra el texto de sin match (B10); singular del banner (B11); el
  orden del DOM sigue la maqueta: propuesta expandida, decisión y filas
  colapsadas (B12); se quitaron Emisor y Receptor de la tarjeta del CFDI
  porque la maqueta no los tiene (B13); la ✓ de referencia y de serie-folio
  solo aparece cuando el servidor devuelve la regla `referencia_monto_exacto`
  (B14); la frase «El motor y la IA solo proponen…» vive solo en la tarjeta de
  decisión (B15).
- **Desviaciones y decisiones de implementación.** Las etiquetas de acciones
  de la bitácora se alinearon con las de la maqueta («El motor propuso el
  CFDI…»); las etiquetas «Sin match» y «Conciliado» no llevan punto final, como
  en la maqueta; la fecha del banner y de la tarjeta de conciliado es el día en
  la zona del navegador y el historial muestra fecha y hora; los fallos 4xx
  genéricos de una acción usan el texto de conectividad ya aprobado; el 403 de
  lectura usa el texto genérico de permiso porque la maqueta no tiene esa
  pantalla; `proporcionTolerancia` devuelve el entero como cadena porque la
  regla de dinero prohíbe `Number`; el panel de decisión acepta un
  `motivoInicial` solo para que la galería muestre el exceso de largo; los
  manejadores de prueba por defecto exponen sus almacenes (`almacenes`) para
  que un flujo fije datos o fuerce un fallo. La prueba estática de literales
  del dominio (`tests/dominio/casoSinLiterales.test.ts`) cubre reglas, roles y
  el código `acceso_denegado`; los estados y las acciones se comparan contra
  uniones tipadas del espejo, donde `tsc` falla si el backend cambia un valor.
  S8 no necesitó cambios de producción ni adaptar pruebas existentes: el
  contenedor ya estaba completo desde S7 y la suite completa siguió en verde.
- **Integrado a `master` el 6 oct** (ver la entrada de ese día).
- **Pendiente: comprobaciones manuales en el navegador, contra las maquetas
  v20** (nadie las ha corrido): cada una de las 14 vistas en ambos temas a
  1440, 900 y 375 px; el monto con 15 o más dígitos y en otra moneda (no se
  parte ni se sale de su caja); la diferencia resaltada y la menor a un
  centavo con su texto oculto; las insignias «IA» y «simulada»; varias
  propuestas (advertencia, expandir y colapsar, nombre accesible del botón
  de confirmar); el contador del motivo de 0 a 500 y el exceso; el estado de
  envío; el 409 que solo recarga al hacer clic; el 403 de D-08 con un segundo
  usuario real; la fila de la bandeja y el contador de la barra lateral tras
  confirmar; recorrido solo con teclado (orden, anillo de foco, tamaño de los
  objetivos); lectura con un lector de pantalla (banner, regiones en vivo,
  nombre del botón de confirmar).
- **Hecha el 6 oct (ver arriba): comprobación en vivo de `GET /casos/:movimientoId`.** Hay que
  reconstruir el contenedor `api`, que sigue sirviendo el `dist` raíz anterior
  sin la ruta; con eso se prueba contra el API de desarrollo con los datos de
  la demo. No se corrió y no se tocó el `dist` raíz.
- **Pendiente (seguimiento, ya existía en `master`): lint de la raíz.** Un
  error en `src/auth/auth.service.spec.ts:263` (`no-unsafe-member-access`) y
  una advertencia en `src/main.ts:34` (`no-floating-promises`). No los
  introduce esta historia y no cambian respecto de `master`.

- **CU-22 terminado: bandeja de revisión en pantalla (KAN-100). Integrado a
  `master` el 5 oct** por avance rápido de la cadena hasta
  `feat/cu-22-15-orden-chips`, sin push ni PR; quedan 22 de 26 historias y
  84 de 99 puntos, y KAN-100 pasa a Finalizado. El usuario probó en el
  navegador la bandeja y los flujos de CU-20 y CU-21 (la lista de abajo) y
  todo quedó correcto; con eso se dan por buenos también los textos de
  `features/bandeja/textos.ts`. Lo entregado:
  - API: `GET /bandeja/resumen` con los conteos por estado y el monto por
    revisar por moneda, con el mismo predicado que la tabla de
    `GET /bandeja`, filtrado por `company_id`, solo lectura y sin migración.
  - Pantalla `/bandeja` en lugar del marcador: cuatro indicadores (tres
    conteos y el monto por revisar, una línea por moneda), chips de estado
    combinables (el último activo no se apaga), tabla de solo lectura en el
    orden del servidor, paginación de 20 en 20 y estados de carga, vacío,
    error y 403. Filtros y página viven en la URL (`?estado=…&pagina=N`):
    se normalizan con `replace`, cambiar de chip reemplaza la entrada y
    cambiar de página la empuja, y una página fuera de rango se reemplaza
    por la última válida sin mostrar el vacío.
  - Tabla: descripción como único enlace a `/casos/:id`, monto con el código
    de moneda si no es MXN, diferencia resaltada por valor exacto (incluida la
    menor a un centavo, con texto oculto), insignia «✦ IA» y «✦ IA ·
    simulada» según el prefijo completo que guarda el backend.
  - El contador de la barra lateral ya es el real (sugerencia + sin match, del
    mismo resumen que los indicadores: una sola petición); se oculta al
    cargar, al fallar y en cero. El marcador `PENDIENTES_PLACEHOLDER` se
    retiró. El encabezado recibe el subtítulo desde el `handle` de la ruta.
  - La galería `/__kit` tiene la sección «Bandeja» con cada pieza y estado.
- **Entrega de CU-22.** Catorce ramas locales apiladas (más las dos correcciones de abajo),
  `feat/cu-22-00-api-resumen` a `feat/cu-22-13-kit-docs` (la 13 incluye estos
  documentos). Se partieron en límites de commit; los cortes que pasan de 400
  líneas por las pruebas (S4, S7, S10 y S11) quedan como candidatos a
  `size:exception`. Tamaño real por rama, contra la anterior: S0 (366+/4-),
  S1 (233+/11-), S2 (354+), S3 (122+/2-), S4 (1,103+/1-), S5 (297+),
  S6 (439+), S7 (602+), S8 (248+), S9 (362+), S10 (449+), S11 (1,020+/14-, en
  tres commits de 57, 780 y 183 líneas), S12 (198+/26-), S13 (301+/1- del kit
  más estos documentos).
- **Verificación de CU-22**, observada en `feat/cu-22-13-kit-docs`: en
  `frontend/`, 105 archivos y 1,807 pruebas en verde; typecheck, lint,
  formato, build y `verificar:dist` limpios. En la raíz, typecheck limpio. El
  backend corrió sus 801 pruebas al cerrar S0 (Postgres y Redis activos) y no
  se volvió a correr después, porque S1 a S13 no tocan `src/`.
- **Correcciones tras la verificación de CU-22.** Dos ramas más sobre la 13:
  - `feat/cu-22-14-flujos-estables` (70+/2-): carrera real en la guarda de
    `/empresa`, heredada de CU-21. Si el contexto de la empresa nueva llegaba
    antes de que el enrutador saliera de `/empresa`, el `ready` se tomaba como
    abandono del cambio y devolvía a la pantalla anterior en vez de ir a
    `/bandeja`. Se veía como pruebas de flujo intermitentes (límite de 5 s).
    Ahora `selecting` expone la época y la guarda solo regresa si no cambió
    (A13). Prueba de estrés con dos suites en paralelo: 4 de 6 con fallo
    antes, 0 de 16 después.
  - `feat/cu-22-15-orden-chips` (49+/25-): chips, indicadores y URL
    canónica siguen el orden del mockup (sugerencia, sin match, conciliado);
    el espejo del backend no cambia (A14).
  - Verificación en `feat/cu-22-15-orden-chips`: en `frontend/`, 106 archivos
    y 1,811 pruebas en verde; el backend, vuelto a correr sobre la 14, 801
    pruebas en verde.
- **Enmiendas a la especificación** (A1 a A15, guardadas en Engram como
  `sdd/cu-22-bandeja/spec-amendments`): la insignia «simulada» exige el
  prefijo completo `Sugerencia de IA: [SIMULADA — no es un modelo real]` y una
  prueba estática lo compara con el backend (A1); `SessionState.ready` suma
  `epoca` para aislar las consultas por sesión y empresa (A2); copia de los
  indicadores y de los estados vacío, error y 403 en un solo archivo,
  `features/bandeja/textos.ts` (A3 a A5); el contador es `undefined` en cero
  (A6); los detalles de error salen de `textos.ts` por tipo y
  `shared/api/mensajes.ts` no cambia (A7); los contratos validan solo lo que
  usa la pantalla (A8); la prueba de precisión del backend usa montos que
  caben en `numeric(18,4)` (A9); `ShellLayout.sesion.test.tsx` y el cableado
  de pruebas del shell (A10); enlace con `encodeURIComponent`, grupo de
  indicadores sin landmark, pares de contraste nuevos, rango dentro del
  `role="status"` y fechas sin pasar por `Date` (A11).
- **Decisiones de CU-22** (Q1 a Q8, aceptadas): el resumen es un endpoint
  propio y consistente con la tabla (Q1); la diferencia se decide por valor
  decimal exacto (Q2); la IA se marca por regla y prefijo (Q3, Q8); al menos
  un chip activo (Q4); la fila enlaza al caso por `movimientoId` (Q5); el
  monto lleva su código de moneda (Q6); el contador de la barra lateral y los
  indicadores comparten una sola consulta (Q7). La CFDI sin serie ni folio se
  identifica por los primeros 8 caracteres de `uuidFiscal` (cierra
  Q-SHORTUUID).
- **Decisiones de implementación de S11.** El contenedor envuelve la tabla y
  la paginación en una región de resultados (enfocable, con `aria-busy` al
  conservar filas durante un cambio de página o de filtro) en vez de agregar
  una propiedad a `TablaBandeja`. El aviso del último filtro sigue montándose
  solo con un chip activo, como en el mockup: el texto queda enlazado por
  `aria-describedby` y no se exige que se anuncie solo. `AlertaError` ganó una
  propiedad opcional `accion` para el botón «Reintentar» dentro de la alerta.
- **Pendiente: copia final de los indicadores y de los estados (R3).** Los
  textos siguen a la espera del visto bueno final del usuario; cambiarlos es
  editar solo `textos.ts`.
- **Pendiente: comprobaciones manuales en el navegador, contra los mockups**
  (nadie las ha corrido): ambos temas a 1440, 900 y 375 px (indicadores,
  chips, tabla, paginación y estados); el monto del indicador con un número
  largo y con dos monedas; la fila en otra moneda; la diferencia resaltada y
  la menor a un centavo; las insignias «IA» y «simulada»; recorrido solo con
  teclado (chips, enlaces, paginación, anillo de foco y tamaño de los
  objetivos); lectura con un lector de pantalla (grupo de chips, resumen de
  estado, `aria-current`, «menor a un centavo», aviso del último chip); Atrás
  y Adelante reales entre cambios de filtro y página, enlace compartido y
  enlace con una página que ya no existe; contador de la barra lateral en
  `/cargas`; y `GET /bandeja/resumen` real contra el API de desarrollo con los
  datos de la demo.

- **CU-21 terminado: inicio de sesión y elección de empresa (KAN-99).**
  Integrado a `master` el 5 oct (avance directo, sin commit de merge; sobre
  `master`, 1,454 pruebas del frontend y 785 del backend en verde). Es la
  última historia de la épica F
  (CU-19, CU-20 y CU-21): con ella van 21 de 26 historias y 79 de 99 puntos;
  CU-22 a CU-26 (20 pts) y las épicas G y H siguen pendientes. Lo entregado:
  - Inicio de sesión real en dos pasos: credenciales y luego empresa, con
    su RFC y los roles como Administrador, Contador y Revisor.
  - Un solo mensaje, "Correo o contraseña incorrectos", para toda causa de
    401 (sin enumerar usuarios). Sigue sin bloqueo de cuenta (D-11).
  - Los tokens viven solo en memoria: recargar la página obliga a iniciar
    sesión de nuevo.
  - Un 401 en una llamada con el token de sesión termina la sesión: aviso
    "Tu sesión terminó…" y regreso a la pantalla pedida solo si se elige de
    nuevo la misma empresa. Un 403 en `GET /auth/contexto` también termina la
    sesión; cualquier otro 403 muestra "No tienes permiso para esta acción."
    y la conserva.
  - Cambio de empresa desde el encabezado: directo mientras dure el token de
    selección (5 minutos); si no, pide la contraseña con el correo ya
    escrito. Se oculta con una sola empresa. Abandonar el cambio devuelve a
    la pantalla exacta, con la sesión viva; un cambio completo aterriza en
    `/bandeja`.
  - "Cerrar sesión" descarta los tokens de la pestaña y limpia la caché de
    consultas, sin afirmar que se revoque en el servidor (no hay endpoint de
    cierre). La caché también se limpia al cambiar a otra empresa y al
    terminar la sesión.
  - Guardas de ruta con destino de retorno validado, que viaja en el estado
    del router. Control de tema (Claro, Sistema y Oscuro) en las pantallas de
    acceso; panel de marca sin contadores.
  - Dependencias nuevas: react-hook-form 7.89.0 y @hookform/resolvers 5.9.1
    (la prueba de compatibilidad pasó, sin alternativa).
- **Entrega de CU-21.** Nueve ramas locales apiladas,
  `feat/cu-21-01-cliente-401` a `feat/cu-21-08-integracion`, más
  `docs/cu-21-cierre`. Se partieron en límites de commit y el usuario
  aprobó la excepción de tamaño para los cortes con muchas pruebas. Tamaño
  real por rama, contra la anterior: 01 (407+/5-), 02 (2,943+/96-),
  03 (1,254+/79-), 04 (1,146+), 05 (1,337+/42-, sin lockfile),
  06 (1,552+/9-), 07 (1,176+/52-), 08 (1,280+/230-). Cerca del 60 % es
  de pruebas.
- **Verificación de CU-21**, observada en `feat/cu-21-08-integracion`: en
  `frontend/`, 76 archivos y 1,450 pruebas en verde; typecheck, lint,
  formato, build y `verificar:dist` limpios. En la raíz, typecheck limpio y
  37 suites con 785 pruebas en verde. Comprobación en vivo contra el API real
  por el proxy de desarrollo, con un usuario de la demo: el login responde
  200 con `usuario` y `empresas`; contraseña errónea y usuario inexistente
  dan el mismo 401, byte por byte; `GET /auth/empresas`,
  `POST /auth/empresa/:id` y `GET /auth/contexto` devuelven las formas
  documentadas; los tokens de otro alcance responden 401.
- **Enmiendas a la especificación** (SA-1 a SA-9, guardadas en Engram como
  `sdd/cu-21-inicio-sesion/spec-amendments`): el cambio de empresa conserva la
  sesión viva hasta elegir otra y abandonarlo vuelve sin recarga (SA-1); el
  regreso al origen tras expirar solo aplica con la misma empresa (SA-2);
  transición `ended -> anonymous` tras mostrar el aviso una vez (SA-3); el
  token de selección no es accesible para el cliente ni el proveedor (SA-4);
  motivos internos que se muestran como aviso de un solo uso (SA-5); `ready`
  incluye `puedeCambiarEmpresa` y aparece `unavailable` (SA-6); una lista
  vacía tras un 403 vuelve al paso 1 (SA-7); el botón de envío queda
  realmente deshabilitado mientras espera (SA-8); el esquema del formulario
  se deriva del contrato `solicitudLogin` (SA-9). La excepción a SA-2 de la
  tarea 2.3: "Cambiar de cuenta" conserva el id de la empresa previa, para que
  otra cuenta que elija una empresa distinta no herede el destino anterior.
- **Correcciones halladas durante la historia:**
  - Un primer inicio de sesión desde un enlace profundo ahora vuelve a la
    pantalla pedida (regla `restaurarOrigen`); antes iba a `/bandeja`.
  - Elegir la empresa que ya está activa durante un cambio equivale a
    regresar sin cambiar.
  - Abandonar el cambio regresa a la pantalla exacta, no a `/bandeja`.
  - Atrás durante un cambio de empresa regresa al paso de empresa y el shell
    ya no se dibuja vacío durante el cambio.
- **Prueba del usuario en navegador:** el usuario probó el inicio de sesión
  en el navegador y lo reportó correcto. No se registraron las demás
  comprobaciones de la lista.
- **Pendiente de CU-21:**
  - Del resto de la lista de comprobación manual en navegador no hay
    constancia: ambos temas a 1440, 900 y 375 px, control de tema en pantallas
    angostas, recorrido solo con teclado, muestra con lector de pantalla,
    acceso, elección, cambio, abandono y cierre reales contra el API de
    desarrollo (barra de direcciones, almacenamiento y consola limpios),
    recarga, botón Atrás tras cerrar sesión y gestor de contraseñas.
  - Siguen pendientes también las comprobaciones en navegador de CU-20.
  - Playwright y el servicio `web` de docker siguen diferidos.
  - Cerrar sesión no revoca el token en el servidor: sigue válido hasta
    15 minutos y no hay sincronía entre pestañas.

### 1 oct 2026

- **CU-20 terminado: base del frontend con tema claro y oscuro (KAN-98).**
  Integrado a `master` el mismo día. Lo entregado:
  - El frontend vive en `frontend/` (Vite 8, React 19, TypeScript 6,
    Vitest 5, React Router 8, TanStack Query 5, zod 4 y decimal.js), aislado
    de las herramientas del backend: `frontend` queda excluido en
    `tsconfig.json` y `tsconfig.build.json`, el ESLint de la raíz lo ignora
    y hay un `.dockerignore` nuevo. El servidor de desarrollo reenvía `/api`
    a `API_TARGET` (sin CORS) y el CI tiene un job `frontend` en paralelo.
  - Tokens por rol para un tema oscuro y uno claro, con una prueba de
    contraste que cumple todos los pares a 4.5:1. Fuentes IBM Plex Sans e
    IBM Plex Mono autoalojadas.
  - La preferencia de tema (`light | dark | system`) se guarda en
    `cuadra.tema`, por defecto `system`, y se aplica antes del primer
    pintado. El control tiene tres opciones: Claro, Sistema y Oscuro.
  - Los montos viajan como cadenas y se formatean con decimal.js: dos
    decimales con redondeo half-up (decisión del usuario; es la misma regla
    del backend). Una regla de lint prohíbe flotantes en el código de dinero.
  - Espejo de los enums del backend con una prueba que detecta la deriva, y
    contratos zod de los endpoints de autenticación.
  - Cliente de API: solo un 403 en `GET /auth/contexto` termina la sesión.
    La sesión entra por una costura con un proveedor provisional, que CU-21
    reemplaza.
  - Siete rutas provisionales y el shell: barra lateral, bloque de usuario
    con los roles como Administrador, Contador y Revisor, y encabezado con
    la empresa. Enlace de salto al contenido y un solo `banner`,
    `navigation` y `main` por página. Bajo 900 px la barra lateral pasa a un
    menú desplegable (enmienda SHL-6 a la especificación). Galería de
    componentes solo en desarrollo, en `/__kit`; `npm run verificar:dist`
    comprueba que no llegue al build ni haya URLs de fuentes externas, y el
    CI lo ejecuta.
  - Decisiones del mismo día: sin bloqueo de cuenta (D-11); tema claro y
    tipografía IBM Plex aprobados por el usuario; control de tema con tres
    opciones.
- **Entrega de CU-20.** Ramas locales apiladas `feat/cu-20-01…` a
  `feat/cu-20-11-shell-layout-kit` (39 commits de código: 36 hasta
  `c4f6070` y 3 del último corte, `4ab5053`, `44b33b7` y `aaa097c`). Cada
  corte se partió en límites de commit. El usuario aprobó la excepción de
  tamaño para los cortes que pasan de 400 líneas por sus pruebas. En total,
  unas 8,300 líneas añadidas sin el lockfile ni las fuentes, cerca del 60 %
  pruebas.
- **Verificación de CU-20:** en `frontend/`, typecheck, lint, formato y
  build limpios; 768 pruebas en 47 archivos; `verificar:dist` limpio. En la
  raíz, typecheck limpio y 785 pruebas en verde. Una verificación
  independiente contra la especificación no encontró bloqueos. Tras integrar
  a `master` (avance directo, sin commit de merge) se repitieron las mismas
  comprobaciones con el mismo resultado.
- **Pendiente de CU-20:**
  - Nadie ha visto las páginas renderizadas en un navegador: no se ha
    comprobado que el tema no parpadee al recargar ni que los montos no se
    partan ni se recorten, y los objetivos de 44 px y los anillos de foco
    solo los cubren pruebas del CSS y de la lógica.
  - Playwright y el servicio `web` de docker quedan diferidos.
  - El plugin de accesibilidad de lint se omitió porque aún no es
    compatible con ESLint 10.
  - Las pantallas de login y de empresa son de CU-21.

- **CU-19 terminado: contexto de sesión para el cliente.** Es la primera
  historia del frontend y solo toca el API. Cambios en las respuestas, sin
  migración:
  - `POST /auth/login` devuelve ahora `usuario {id, nombre, email}` y, por
    empresa, `rfc` y `roles`. El `usuario` sale de la entidad que ya cargó
    la validación de credenciales, sin consulta extra.
  - `GET /auth/empresas` sigue siendo un arreglo simple y repite la misma
    lista, con `rfc` y `roles`.
  - Nuevo `GET /auth/contexto` (token de sesión): `usuario`,
    `empresa {id, razonSocial, rfc}` y `roles`, en una sola consulta con el
    mismo predicado que usa el guard de roles. No incluye `passwordHash` y
    el id de empresa viene solo del token.
  - Los roles siguen fuera del JWT (D-09) y salen en orden fijo.
  - Un 403 de `/auth/contexto` escribe una fila `acceso_denegado`; el
    cliente debe tratarlo como el fin de la sesión.
- **Decisión D-11: sin bloqueo de cuenta por intentos fallidos.** Bloquear
  daría a cualquiera una negación de servicio gratuita contra un usuario
  cuyo correo conozca, y una respuesta "cuenta bloqueada" revelaría qué
  correos existen. Quedan fuera de CU-19 el token de refresco, el logout,
  CORS y la duración de los tokens.
- **Alcance del frontend registrado.** Tres épicas nuevas: F · Base de la
  interfaz (KAN-96: CU-19 a CU-21), G · Revisión en pantalla (KAN-105:
  CU-22 y CU-23) y H · Cargas y control (KAN-106: CU-24 a CU-26). El
  proyecto pasa a 26 historias y 99 puntos (69 + 30); con CU-19 hay 19
  historias y 71 puntos hechos, y CU-20 a CU-26 (28 puntos) quedan
  pendientes y sin fecha.
- **Entrega en dos cortes apilados** (`stacked-to-main`, sin remoto: se
  integran a mano en `master`): `feat/cu-19-usuario-roles` (6d6c0f6, login y
  `/auth/empresas`) y `feat/cu-19-auth-contexto` (9d4b24d, `/auth/contexto`),
  de unas 323 y 367 líneas cambiadas. En total, 6 archivos de `src/auth`,
  672 inserciones y 18 borrados, casi todo pruebas. Este archivo va en una
  tercera rama, `docs/cu-19-cuadra`.
- **Verificación:** `npm run typecheck` limpio y la suite completa en verde:
  785 pruebas (761 antes y 24 nuevas). El runner de la demo y la colección
  de Postman siguen compatibles: los campos nuevos son aditivos.
- **Arreglo de pruebas del mismo día** (0551bca): las suites que revierten
  migraciones ahora vacían la bitácora antes de revertir.
- **La bitácora sale de `CUADRA.md`.** Pasa a este archivo
  (`docs/bitacora.md`) para que el contexto vigente se lea sin cargar todo
  el historial: `CUADRA.md` baja de unas 2,180 líneas a unas 900. Rama
  `docs/bitacora-aparte`, que también lleva las reglas del frontend en
  `CLAUDE.md`.
- **Integrado a `master` el mismo día** (avance directo, sin commit de
  merge). Sobre `master`: `npm run typecheck` limpio y 785 pruebas en verde.
- **Pendiente:** CU-20 a CU-26 (el frontend). En las pruebas de
  `/auth/contexto` falta comprobar el texto del 403 y la fila de bitácora
  cuando se desactiva el usuario o la empresa.

### 30 sep 2026

- **Verificación final antes de la entrega.** Todo lo de CU-11 a CU-18 está
  fusionado en `master`, y las cinco épicas y las 18 historias están en
  Finalizado en Jira.
  - **De cero a demo, medido: 56 segundos.** Se siguieron los pasos del
    README en un clon limpio de `master` (`92c7bb5`), con un proyecto de
    Docker aparte, volúmenes nuevos y la imagen `api` construida sin caché:
    build 26 s, `up -d` 11 s, `migration:run` 3 s (las 14 migraciones),
    `seed` 3 s y `demo` 13 s, que termina con "todo coincide con lo
    esperado". Las imágenes base (`node:22-alpine`, `postgres:18-alpine`,
    `redis:7-alpine`) ya estaban descargadas; en una máquina sin ellas se
    suma su descarga. El criterio de CU-18 (menos de 5 minutos) se cumple.
  - **Resuelto el `esquema.spec` intermitente** (pendiente 3 de CU-18,
    commit `92c7bb5`). La prueba del índice parcial afirmaba la elección del
    planificador sobre `cfdi`, una tabla que otras suites dejan con filas en
    la base de pruebas compartida. Con estadísticas de una tabla chica y casi
    toda coincidente, Postgres elige con razón un Seq Scan (reproducido en
    transacciones revertidas). Ahora la prueba fija `SET LOCAL
    enable_seqscan = off` dentro de su transacción y comprueba que el índice
    sirve para la consulta, sin depender de lo que dejaron otras suites.
    Queda un riesgo parecido, sin fallas observadas: tres pruebas de
    `esquema.spec` esperan exactamente 2 empresas y 4 usuarios.
  - **Resuelto el pendiente 4 de CU-18:** la pila de ramas se fusionó por
    fast-forward, sin rebase.
  - **Sigue abierto:** la prueba de humo contra la API real de Anthropic
    (sin presupuesto por ahora; la función viene apagada por omisión) y la
    persistencia de `nombre_emisor` y `nombre_receptor`. El workflow de CI
    nunca corrió en GitHub porque el repositorio no tiene remoto.

- **CU-18 terminado: demo y datos sintéticos.** Tres PR encadenados
  (`stacked-to-main`) con excepción de tamaño aceptada en los tres: (1) el
  proveedor de IA simulado y su selección por entorno, (2) el generador
  determinista, los datos y sus pruebas guarda, (3) el runner HTTP, el
  README y esta bitácora. Con esto las 18 historias están hechas: 69 / 69
  puntos.
  - **Una demo de cero en menos de 5 minutos:** `cp .env.example .env`,
    `docker compose up -d --build`, `migration:run`, `seed` y
    `docker compose exec api npm run demo` (el README los lista). Son 40
    facturas y 50 movimientos de Ferretería más un conjunto chico de
    Transportes (4 y 5), todos inventados: RFC de prueba, nombres terminados
    en "(sintético)", sellos `SINTETICO`.
  - **Datos reproducibles:** `scripts/demo/escenarios.ts` es la única fuente
    de verdad (tabla explícita de casos difíciles más relleno con `mulberry32`
    de semilla fija, fechas fijas de agosto y septiembre de 2026, UUID
    derivados por sha256). `npm run demo:generar` escribe `demo/`; una prueba
    de deriva falla si lo commiteado difiere de lo generado, y otras vigilan
    privacidad (lista de RFC permitidos, sin correos ni teléfonos), formato
    (cada archivo pasa por los lectores reales) y motor (el motor real más la
    IA simulada reproducen lo esperado, sin base de datos).
  - **Decisión: el diseño gana sobre la spec en los conteos.** La spec
    (escrita antes de leer el motor) esperaba 23 conciliados tras cargar;
    pero el motor **nunca concilia**, solo propone, así que tras las cargas
    hay 0 conciliados. Lo esperado es Ferretería 26 sugerencias (4 de IA) /
    13 sin match / 0 conciliados tras el estado de cuenta 1; 27 / 15 / 0
    tras subir la tolerancia de 5.00 y el estado de cuenta 2; y 25 / 16 / 1
    al final, tras confirmar una propuesta y rechazar otra. Transportes
    3 / 1 / 0. Los conteos se derivan de la tabla (`esperado()`), no están
    escritos a mano, y si los datos no los producen se corrige el dato,
    nunca el motor. Los datos coincidieron a la primera, sin ajustes.
  - **IA simulada, explícita y acotada:** `ProveedorSimulado` (modelo
    `simulado-demo`) es puro y determinista: cita la factura en la
    descripción o, con varios candidatos, la única de monto exacto; con un
    solo candidato sin cita se abstiene (un falso positivo es peor que no
    conciliar). La etiqueta `[SIMULADA — no es un modelo real]` va en el
    texto de la explicación (sin cambio de esquema). `LLM_PROVEEDOR`
    (`anthropic` por omisión, o `simulado`) se **rechaza con
    `NODE_ENV=production`**, tanto en la validación del entorno como en la
    fábrica, y el arranque avisa una vez en el log. `.env.example` trae la
    demo lista (`LLM_HABILITADO=true`, `LLM_PROVEEDOR=simulado`).
  - **El runner se autoverifica:** cliente HTTP con `fetch` y `FormData`
    nativos, solo a loopback salvo `DEMO_PERMITIR_REMOTO=1` (usa la
    contraseña pública del seed). Sube CFDI y luego el CSV (nunca al
    revés, por la cola de conciliación), espera al motor y a la IA con
    tiempo límite y una ventana de calma, sube la tolerancia, demuestra D-08
    (quien subió recibe 403, otra persona confirma), rechaza con motivo,
    revisa el historial y el aislamiento entre empresas (404 y 403). Repetir
    la demo responde `yaExistia` y termina con código 0, con la pista de
    `docker compose down -v`. El mismo runner lo ejecuta una prueba de
    integración contra la app real (Postgres con RLS, Redis y worker) con
    aserciones sobre la base: conciliaciones por estado y origen, 7
    consultas de IA, 4 propuestas `llm` auditadas con modelo `simulado-demo`
    y ninguna `llm` confirmada.
  - **Build aislado:** `tsconfig.build.json` excluye `scripts` y `demo`;
    sin eso `nest build` movería la salida a `dist/src/main.js` y
    `start:prod` se rompería. Se verifica `dist/main.js`.
  - **Pruebas:** 761 en total, sin `ANTHROPIC_API_KEY`. Ninguna llama a una
    API de IA real. Además se corrió la demo completa contra el stack local
    de Docker (12 segundos, código 0).
  - **Pendientes y límites conocidos:** (1) la prueba de humo contra la API
    real de Anthropic sigue pendiente (ver CU-17): la demo no la sustituye.
    (2) `guardarCfdi` no persiste `nombre_emisor` ni `nombre_receptor`: la
    bandeja muestra `nombreReceptor` nulo y el payload de la IA lleva el
    receptor vacío; los nombres "(sintético)" viven solo en el XML. Fuera de
    alcance; queda como seguimiento. (3) `esquema.spec` falla de forma
    intermitente en algunas corridas; sin causa confirmada y sin tocar
    en esta historia. (4) La pila de ramas
    (`feat/cu-17-anthropic` → `feat/cu-18-demo` → `feat/cu-18-datos` →
    `feat/cu-18-runner`) debe rebasarse sobre `main` cuando se fusione CU-17.

- **CU-17 terminado: sugerencia asistida por IA.** Dos PR encadenados
  (`stacked-to-main`) con excepción de tamaño aceptada en ambos: primero el
  dominio (puerto, candidatos, validador, persistencia y migración
  `SugerenciasIa1790709000000`), luego el adaptador de Anthropic, la cola y
  esta documentación. Decisión del proveedor en D-10; el riesgo "¿qué
  proveedor de LLM?" queda cerrado.
  - **Qué hace:** para los movimientos abiertos que el motor dejó con
    `referencia_ambigua`, `monto_multiples_candidatos` o
    `cfdi_multiples_movimientos`, pregunta al modelo cuál de los CFDI que el
    propio motor ya considera compatibles corresponde. El conjunto de
    candidatos sale de `candidatosAmbiguos` (mismas reglas del motor), no de
    una heurística nueva; sin candidatos, o con más de `LLM_CANDIDATOS_MAX`,
    no se pregunta (truncar podría esconder el CFDI correcto).
  - **Nunca cierra un caso:** inserta una conciliación `origen 'llm'`,
    `estado 'propuesta'`, `regla 'llm_sugerencia'`, sin score, con el motivo
    `Sugerencia de IA: ...` (sin caracteres de control, máx. 500), más la fila
    `crear` de la bitácora (CU-16, `user_id` nulo, con modelo y huella) y la
    limpieza del motivo del movimiento, todo en una transacción. La
    confirmación sigue siendo de una persona (CU-15); no se agregó ningún
    CHECK nuevo sobre `origen` porque bloquearía esa confirmación, y una
    prueba demuestra que la IA no produce `confirmada`.
  - **La llamada va fuera de candado y de transacción.** Después se vuelve a
    leer todo bajo el candado de conciliación (estado, regla y motivo del
    movimiento, CFDI libre, sin conciliación viva); si algo cambió, no se
    escribe nada y la siguiente corrida reevalúa.
  - **Idempotencia:** `sugerencias_ia` (append-only, RLS con FORCE, solo
    `SELECT, INSERT` para `cuadra_app`) guarda la huella de cada pregunta
    (sha256 de movimiento + candidatos + modelo + versión del prompt). Misma
    huella, no se vuelve a preguntar. Un "ninguno", un rechazo del modelo o
    una confianza baja también quedan registrados; un fallo del proveedor no.
    Un par que una persona rechazó sale del conjunto de candidatos.
  - **Fallos y límites:** el primer error del proveedor corta la corrida
    (el job termina bien, se reintenta en la siguiente) y hay un tope de
    `LLM_MAX_LLAMADAS_POR_CORRIDA` llamadas. Cola `sugerencias`: un intento,
    `jobId` `sugerencias-<companyId>`, encolada después de `conciliar` en su
    propio `try/catch`; apagada, ni se toca Redis.
  - **SDK verificado contra los tipos instalados** (`@anthropic-ai/sdk`
    0.129.0): `timeout` (ms) y `maxRetries` son opciones del constructor
    (`maxRetries: 0`), `output_config` admite `effort` y `format`, y
    `StopReason` incluye `refusal` y `max_tokens`. `stop_reason` se revisa
    antes de leer el contenido.
  - **Pruebas:** 695 en total, sin `ANTHROPIC_API_KEY`: el adaptador se
    prueba con un cliente doble (forma de la petición: sin `thinking`,
    `tool_choice`, betas ni `fallbacks`; `refusal` y `max_tokens`; JSON
    roto; errores de la API), el entorno tiene sus casos y la cola se prueba
    de punta a punta con `ProveedorFalso` contra Postgres con RLS y Redis.
    **Ninguna prueba llama a la API real.**
  - **Pendiente: prueba de humo contra la API real.** Quien tenga la llave
    debe correrla una vez antes de activar la función en un entorno real
    (`LLM_HABILITADO=true` y `ANTHROPIC_API_KEY` en `.env`, con un
    movimiento ambiguo cargado; debe aparecer una propuesta `llm` en la
    bandeja y una fila en `sugerencias_ia`). No se confirmó que el modelo
    acepte exactamente este esquema hasta hacerla.
  - **Límites conocidos:** (1) si una carga termina mientras corre el job de
    la empresa, el `add` se ignora por el `jobId` y esa carga espera al
    siguiente disparo: latencia, no pérdida. (2) Una propuesta `llm`
    equivocada bloquea el par para el motor hasta que alguien la rechaza.
    (3) El umbral de confianza (`alta` y `media`, no `baja`) es una
    decisión de producto revisable (`MIN_CONFIANZA`).

- **CU-16 terminado: bitácora de auditoría.** Dos PR encadenados
  (`stacked-to-main`), con excepción de tamaño aceptada en ambos: primero la
  escritura y la prueba de solo lectura, luego la consulta. Sin migración:
  `'crear'` ya estaba en `ck_bitacora_accion`.
  - **El motor audita:** `ConciliacionService.insertar` es ahora una sola
    sentencia (CTE que inserta las propuestas y, con `RETURNING`, una fila
    `crear` por cada propuesta **nueva**). Van juntas por construcción, dentro
    del mismo candado y la misma transacción: no hay propuesta sin rastro ni
    rastro sin propuesta. Lo que `ON CONFLICT DO NOTHING` omite no genera fila,
    así que volver a conciliar no duplica nada. `user_id` es `NULL` (lo hizo el
    sistema); `datos` lleva `despues.estado`, `origen`, `regla`, `score` y
    `diferenciaMonto` como texto, `cfdiId` y `movimientoId`.
  - **Solo lectura, probada:** como `cuadra_app`, `UPDATE`, `DELETE` y
    `TRUNCATE` sobre `bitacora` fallan con `42501`, y `has_table_privilege`
    confirma `SELECT`/`INSERT` sí y el resto no. Sin trigger (D3): los GRANTs
    bastan y un trigger rompería la limpieza de las pruebas. El dueño de la
    tabla no pasa por esto; queda fuera de alcance.
  - **`GET /conciliaciones/:id/historial`:** los eventos de una conciliación de
    más antiguo a más nuevo, sin paginar, `{ datos }`. Cada uno lleva `id`,
    `entidad`, `entidadId`, `accion`, `datos` (tal como se guardó),
    `createdAt` y `usuario` `{ nombre, email }` o `null` cuando fue el motor.
    No expone `ip` ni `userAgent`. 400 si el id no es UUID; 404 idéntico para
    inexistente y ajena. Una propuesta anterior a CU-16 no tiene fila `crear`:
    devuelve solo lo posterior (sin backfill).
  - **`GET /bitacora`:** filtros `entidad` (texto, máx. 64), `entidadId`,
    `userId`, `accion` (una de `ACCIONES_BITACORA`) y `desde`/`hasta` ISO 8601
    estricto, **semiabierto** `[desde, hasta)`; `desde > hasta` es 400. Un
    `hasta` de solo fecha es medianoche UTC y excluye ese día. `pagina` y
    `limite` como la bandeja (50 por defecto, máx. 200). Orden `created_at DESC,
    id DESC`; devuelve `{ datos, pagina, limite, total }` con `ip` (`host(ip)`)
    y `userAgent`.
  - **Historia de un CFDI o de un movimiento:** con `entidad=cfdi` o
    `entidad=movimientos` y `entidadId`, el filtro también trae las filas de
    sus conciliaciones, por un join con `conciliaciones` (`cfdi_id` o
    `movimiento_id`). Así funciona con las dos formas de `datos` de CU-15
    (`confirmar` anida `cfdi.id` y `movimiento.id`; `rechazar` guarda `cfdiId`
    y `movimientoId` planos) sin leer el jsonb ni indexarlo.
  - **Módulo:** `src/bitacora/bitacora.module.ts`, SQL crudo en la transacción
    de la petición (RLS como `cuadra_app`), `company_id` en cada consulta y
    join. admin, contador y revisor; sin token, 401.
  - **Pendiente, sin tocar:** `esquema.spec` falló una vez en una primera
    corrida completa, en CU-13 y en el PR 1 de CU-16, y al repetirla pasó
    (sola y en corridas completas). Sin causa identificada; conviene
    vigilarla.

### 29 sep 2026

- **CU-15 terminado: resolver un caso (`POST /conciliaciones/:id/confirmar` y
  `/rechazar`).** Dos PR encadenados (`stacked-to-main`), con excepción de
  tamaño aceptada: rechazo (con la infraestructura común) y luego confirmación.
  Sin migración; módulo nuevo `src/resolucion` con SQL crudo en la transacción
  de la petición (RLS como `cuadra_app`).
  - **Común:** admin, contador y revisor. Todo corre bajo el mismo candado
    consultivo que `conciliar()` (extraído a `conciliacion/candado.ts`) y
    bloquea conciliación, CFDI y movimiento `FOR UPDATE` en ese orden. Solo una
    `propuesta` transiciona. Orden de comprobaciones: 404 (igual para
    inexistente y ajena) → 409 → 403. Una violación de unicidad (23505) es 409.
  - **Rechazar:** la conciliación queda `rechazada` y el motivo opcional
    (máx. 500) se guarda; sin motivo se conserva el de la propuesta. CFDI y
    movimiento siguen abiertos. Si el rechazo libera un lado, `conciliar` corre
    una vez tras el COMMIT; si falla se loguea y el rechazo sigue en pie.
    Quien subió la carga sí puede rechazar.
  - **Confirmar:** conciliación `confirmada` con `confirmada_por_id` y
    `confirmada_at`; CFDI `conciliada` (el "pagado" de Jira); movimiento
    `conciliado` con `motivo_sin_match`, `regla_sin_match` y `evaluado_at`
    limpios. Exige CFDI `abierta` y movimiento `abierto`. Una diferencia de
    monto distinta de cero se permite y queda en la bitácora.
  - **Hermanas:** las otras propuestas del mismo movimiento o del mismo CFDI
    pasan a `rechazada` con el motivo "cerrada al confirmar otra conciliación",
    cada una con su fila `rechazar`. Devuelve sus ids en
    `rechazadasAutomaticamente`.
  - **D-08 (segregación):** quien subió la carga del CFDI o la del movimiento
    no confirma (403); un `carga_id` nulo no restringe. Como el 403 revierte la
    transacción, el rastro `acceso_denegado` se escribe en una transacción
    propia con `AccesosDenegados` (se provee en `ResolucionModule`; `AuthModule`
    no lo exporta).
  - **Bitácora:** una fila `confirmar` o `rechazar` por transición, con antes y
    después y `diferenciaMonto` como texto. Viven en la entidad `conciliaciones`
    (las transiciones del CFDI y del movimiento van dentro de `datos`): CU-16
    debe leer `datos->>'cfdiId'` y `datos->'movimiento'->>'id'`.
  - **Pruebas:** integración contra Postgres real: 404/409/403, hermanas,
    concurrencia (dos hermanas, confirmar contra rechazar, confirmar contra
    `conciliar`), que el motor no toque lo confirmado y que la bandeja liste el
    par en `conciliado`. No hay un rol distinto de los tres, así que "los demás
    reciben 403" no se puede probar.

- **Endurecimiento: llaves foráneas compuestas en `conciliaciones`.** Al
  construir CU-14 se vio que `cfdi_id` y `movimiento_id` no amarraban
  `company_id`: el dueño de la tabla (que no pasa por RLS) podía cruzar un
  CFDI o un movimiento de otra empresa. RLS y el motor lo impedían en la app;
  ahora también lo impide el esquema.
  - **Migración `1790708900000`:** `UNIQUE (company_id, id)` en `cfdi` y
    `movimientos` (destino obligado de una FK compuesta) y FK
    `(company_id, cfdi_id)` y `(company_id, movimiento_id)` con el mismo
    `ON DELETE CASCADE`. Se sueltan las FK de un solo campo, que quedaban
    redundantes; conservan nombre. `down()` las restaura.
  - **Pendiente, sin tocar:** `movimientos.carga_id` y `cfdi.carga_id`
    (`SET NULL` anularía también `company_id`, pide `SET NULL (carga_id)`),
    `carga_archivos.carga_id` (mismo patrón, `CASCADE`) y las FK a `users`
    (`confirmada_por_id`, `subido_por_id`), que no llevan empresa.

- **CU-14 terminado: bandeja de revisión (`GET /bandeja`), solo lectura.**
  Dos PR encadenados (`stacked-to-main`), unas 830 líneas en total, más de
  la mitad pruebas: la consulta con estado derivado, filtro y orden (~450),
  y luego la paginación, la mejor propuesta, el motivo por estado y el
  aislamiento (~400). Sin migración.
  - **Módulo `src/bandeja`:** controlador, servicio con SQL crudo por
    `ContextoEmpresa.manager()` (RLS como `cuadra_app`) y DTOs. Cualquier
    miembro lee (admin, contador, revisor); la empresa sale solo del token y
    un `companyId` en la query es 400.
  - **Una fila por movimiento** (abonos, `monto > 0`, sin descartados). Estado
    derivado: `sugerencia` (abierto con propuesta vigente), `sin_match`
    (abierto sin propuesta y con `regla_sin_match`; también solo-rechazadas) y
    `conciliado` (vacío hasta CU-15). Lo nunca evaluado no se lista.
  - **Filtro y paginación:** `estado` repetible (sin él, `sugerencia` y
    `sin_match`); `pagina` y `limite` (50 por defecto, máximo 200), orden
    `monto DESC, id`. `total` sale de un conteo aparte con el mismo filtro,
    así una página fuera de rango conserva el total.
  - **Mejor propuesta:** `LEFT JOIN LATERAL` por score descendente y id;
    `propuestasCount` cuenta solo las vigentes. Para un conciliado toma la
    fila `confirmada`. Todo NUMERIC sale como texto (`::text`).
  - **Motivo por estado (la spec manda):** `motivo` y `regla` de la fila son
    los de la mejor propuesta, los guardados en el movimiento (`sin_match`) o
    los de la confirmada. Nunca se expone `evaluado_at` ni `cfdi.xml_raw`; el
    join a `cfdi` también filtra por `company_id`.
  - **Pruebas:** 40 nuevas de integración contra Postgres real; suite
    completa 440 / 440.

- **CU-13 terminado: cada resultado del motor lleva su motivo guardado.**
  Dos PR encadenados (`stacked-to-main`): motor puro con motivos, y
  persistencia. Las propuestas ya guardaban `motivo`; el hueco eran los
  movimientos sin propuesta, que la bandeja de CU-14 necesita explicar.
  - **Enfoque:** tres columnas nulas en `movimientos`: `motivo_sin_match`
    (texto en español), `regla_sin_match` (código estable) y `evaluado_at`.
    Van juntas o no van (`ck_movimientos_sin_match_par`), y el código solo
    puede ser uno de siete (`ck_movimientos_regla_sin_match`):
    `referencia_ambigua`, `referencia_cfdi_ocupado`,
    `referencia_cfdi_no_compatible`, `sin_candidato_monto`,
    `monto_multiples_candidatos`, `monto_candidato_ocupado`,
    `cfdi_multiples_movimientos`. Un código nuevo es una migración nueva.
  - **Motor:** `evaluarConMotivos` devuelve `{propuestas, sinMatch}` y
    `seleccionarPropuestas` quedó como envoltorio. Cada abono abierto termina
    en exactamente una de tres: ocupado, propuesta o motivo. Los motivos de
    propuesta ya no llevan el prefijo "Regla <id>:" y el exacto agrega la
    diferencia cuando no es cero.
  - **Persistencia (dentro del candado y la transacción de `conciliar`):**
    el UPDATE por lote con `jsonb_to_recordset` solo escribe si el código o el
    texto cambian (`IS DISTINCT FROM`), así que re-correr no reescribe filas.
    Un segundo UPDATE limpia las tres columnas de todo abono abierto con
    conciliación vigente: un motivo nunca convive con una propuesta. Nunca
    toca `estado`, cargos (monto <= 0) ni movimientos conciliados o
    descartados; todas las sentencias filtran por `company_id`.
  - **`evaluado_at`:** momento en que se fijó o cambió el resultado guardado,
    no la última corrida (spec RE-4). NULL con propuesta o sin evaluar.
    Movimientos anteriores a la migración se llenan en la siguiente corrida.
  - **EXPLAIN:** el `NOT EXISTS` sobre `conciliaciones` por `movimiento_id`
    no tenía índice: `ux_conciliaciones_par` empieza por `cfdi_id`, y el plan
    recorría todas las filas de la empresa por búsqueda (30k movimientos, 15k
    conciliaciones, 500 búsquedas: 510 ms). Con
    `ix_conciliaciones_company_id_movimiento_id` bajó a 13 ms; el índice va en
    la misma migración.
  - **Límites conocidos:** un motivo guardado no se limpia si el movimiento
    sale de `abierto` por otra vía (CU-15 puede limpiarlo al confirmar); CU-14
    debe filtrar `estado = 'abierto'`. Cambiar la tolerancia (CU-12) no corre
    `conciliar`: los motivos quedan como estaban hasta la siguiente corrida.
  - **Verificación:** 400 tests en verde (19 suites), `typecheck` y eslint
    limpios.

- **CU-12 terminado: la tolerancia vive en la configuración de cada empresa.**
  `companies.tolerancia_monto numeric(18,4) NOT NULL DEFAULT 0`: toda empresa
  arranca estricta y se afloja a propósito, nunca al revés.
  - **Decisiones:** monto absoluto en MXN, sin porcentaje. Rango 0–100.00 con
    `CHECK` en la base. `GRANT UPDATE` a `cuadra_app` solo sobre esa columna.
    La tolerancia aplica solo a pares en MXN; otras monedas siguen exactas.
    Cambiarla no vuelve a correr `conciliar`: aplica desde la siguiente
    corrida, porque el motor nunca retira propuestas.
  - **Motor:** `ToleranciaPorEmpresa` reemplaza a `ToleranciaConstante` en
    `conciliacion.module.ts`, con el mismo token y la misma firma
    `obtener(companyId)`. Lee el valor como texto hacia `dinero()`, nunca como
    `Number`.
  - **Endpoints:** `GET /empresa/tolerancia` para cualquier miembro de la
    empresa, y `PUT /empresa/tolerancia` solo para `admin` (primera ruta
    exclusiva de admin). Recibe el monto como texto decimal validado. La
    empresa sale del token, nunca del body. Cada cambio escribe `actualizar`
    en `bitacora` con valor anterior y nuevo, en la misma transacción.
  - **Verificación:** 373 tests en verde (19 suites), `typecheck` limpio.
    Revisión aprobada, sin bloqueos. Commits `f3c3373` y `a61627b`.
  - **Límites conocidos:**
    - El `PUT` no actualiza `companies.updated_at`, porque el `GRANT` cubre
      solo `tolerancia_monto`.
    - La revisión sugiere responder 404 en lugar de 500 si la empresa del
      token ya no existe.

- **CU-11 terminado: el motor de reglas propone cruces CFDI–movimiento.**
  Tres PR encadenados (`stacked-to-main`): normalizador y columna
  `referencia_norm`; motor puro `evaluarPar`/`seleccionarPropuestas`; y
  `ConciliacionService.conciliar(companyId)` con su gancho en el worker.
  - **Qué hace.** Tras el commit de cada carga (CFDI o estado de cuenta, y
    también si el job encuentra la carga ya procesada) corre `conciliar`
    en una sola `TransaccionEmpresa`: candado `pg_advisory_xact_lock` por
    empresa, lee abonos abiertos y CFDI de ingreso abiertos emitidos por la
    empresa, y escribe con un `INSERT ... ON CONFLICT DO NOTHING`. Solo
    crea filas `propuesta`/`regla`; nunca confirma ni cambia estados de
    movimientos o CFDI (CU-15 decide). Un fallo del motor se loguea y no
    cambia el estado de la carga.
  - **Reglas y scores** (criterios C1–C4 de KAN-88): `referencia_monto_exacto`
    1.0, `referencia_monto_diferente` 0.5 (guarda la diferencia con signo y
    dice que es sugerencia), `monto_unico` 0.4. Referencia de menos de 3
    caracteres, o que coincide con 2+ CFDI, no sirve de llave. Cada fila
    guarda su `motivo` en español (base para CU-13).
  - **Tolerancia.** `ProveedorTolerancia` es el token que CU-12 cambia por
    una fuente por empresa; hoy `ToleranciaConstante` devuelve 0 MXN.
  - **Rulings.** La spec gana sobre el diseño: los ceros se quitan solo del
    primer bloque de dígitos tras las letras iniciales. Columna generada
    con la opción (a): `typeorm_metadata` se crea sola por TypeORM y la
    migración solo inserta y borra su fila. SD4: ambigüedad por referencia
    no cae a monto. SD5: `monto_unico` exige unicidad en ambos lados. Los
    ocupados (con conciliación no rechazada) siguen contando como
    candidatos. PR2a (motor puro, 588 líneas) fue `size:exception`
    aceptada por el usuario.
  - **Verificación.** `typecheck` limpio; suite completa en verde dos veces
    seguidas (18 suites, 331 tests), con 27 casos de integración contra
    Postgres y Redis reales (idempotencia, concurrencia, RLS, gancho por
    worker).
  - **Huecos conocidos.** Dígitos pegados a la serie sin separador no
    coinciden. Una propuesta `monto_unico` vieja no se retira si después
    llega un CFDI que la vuelve ambigua (el motor nunca modifica filas
    existentes). La tolerancia es constante hasta CU-12.

- **Auditoría de criterios de aceptación de Jira contra el código.** Los 60
  criterios de CU-01…CU-18 se cruzaron con implementación y tests. CU-05 a
  CU-10 cumplen todos. Tres historias de la épica A tenían criterios sin
  cumplir y se reabrieron (KAN-78, KAN-80, KAN-81). Rama
  `fix/criterios-fundacion`; detalle en `odd/tasks/criterios-fundacion.md`.
  - **CU-01.2 (`ae199f3`):** `/health` ahora reporta `redis` además de
    `postgres`; 503 con el detalle por dependencia si una cae. Test de
    integración con Redis arriba y caído, y test de que `validateEnv`
    nombra la variable faltante (CU-01.3 no tenía test). Se borró el e2e
    de ejemplo de Nest (`GET /` → "Hello World!"), que nunca corría.
  - **CU-03.3 (`f7ddf77`):** un 403 por rol, o por no tener membresía en la
    empresa, escribe `acceso_denegado` en `bitacora`. El guard corre antes
    del interceptor de transacción, así que el registro abre su propia
    `TransaccionEmpresa` con el `company_id` del token firmado. Si el
    INSERT falla se loguea y la respuesta sigue siendo 403. Migración
    `AccesoDenegadoEnBitacora` solo amplía `ck_bitacora_accion`; sin
    tabla nueva, RLS y GRANTs ya existían.
  - **CU-04.2 (`d4944c2`):** `.github/workflows/ci.yml` corre `typecheck` y
    `npm test` con Postgres 18 y Redis en cada push y PR. Incluye
    `aislamiento.spec.ts` y `rls.spec.ts`, así que romper el aislamiento
    rompe el build. Verificado en local con entorno limpio; falta ver una
    corrida real en GitHub (el repo no tiene remoto todavía).
  - **Verificación:** 224 tests en verde (14 suites), `typecheck` limpio.
    Revisión de 4 lentes aprobada sin bloqueos.
  - **Pendientes no bloqueantes de la revisión:** un usuario puede inflar
    `bitacora` repitiendo 403 (sin límite de tasa); el chequeo de Redis
    abre una conexión por cada `/health`; el INSERT de auditoría agrega
    latencia al 403.
  - **Hallazgos fuera de alcance, sin tocar:** no hay test de que el
    backoff de CU-08 crezca; la spec de tablas en este archivo omite
    columnas reales (`movimientos.moneda`, `cfdi.serie`/`folio`/nombres,
    estado `parcialidades`); la entrada del 22 sep dice Postgres 17 y el
    compose usa 18; `companies` no tiene dónde guardar la tolerancia de
    CU-12; Jira pide CFDI "pagado" en CU-15 y el esquema solo tiene
    `conciliada`.

### 28 sep 2026

- **CU-10 terminado: un formato por banco.** Perfiles declarativos en
  `src/bancos/perfiles/*.json`, validados con Zod al arrancar. Cómo agregar
  un banco: tabla `movimientos`, "Cómo agregar un banco".
  - **Verificación:** 207 tests en verde (164 + 43), estables en dos
    corridas. Lint, `typecheck` y build limpios; build copia los JSON a
    `dist/` (assets en `nest-cli.json`). `migration:generate --check` sin
    cambios. `docker compose up -d --build -V` + `/health` ok, `GET
    /bancos/perfiles` y una carga real de `banco-sur` con la fila mala en
    la línea 6.
  - **Un solo camino.** El formato canónico de CU-09 es el perfil
    `cuadra`. `formato-canonico.ts` pasó a `lector-estado-cuenta.ts`, que
    recibe el perfil y normaliza toda fila a fecha, concepto, referencia y
    monto con signo. POST y worker son los de CU-09: el POST valida con el
    perfil elegido y guarda el texto ya decodificado, y el worker lee
    `cargas.perfil`.
  - **El JSON es solo datos:** enums para codificación, separadores y
    formato de fecha, y `.strict()` para que una llave con typo no se
    ignore en silencio. La expresión regular de los números se arma en el
    código con los separadores del enum.
    - Refinamientos: `monto` o `cargo` + `abono` (no ambos, no solo uno);
      miles ≠ decimal; las columnas mapeadas existen en `encabezados`; sin
      encabezados repetidos; `id` = nombre del archivo.
    - Un perfil inválido lanza en la fábrica de `PerfilesBancarios`, y la
      api no levanta. El error dice el archivo y el campo.
  - **Agregado al esquema pedido: `encabezados`**, la fila completa y
    exacta. Sin ella, un banco con columnas que no se usan (el saldo, casi
    siempre) no se podía describir. Además `cuadra` conserva el
    "encabezados exactos, en orden" de CU-09.
  - **Preámbulo:** se corta antes de parsear, porque son líneas libres que
    pueden traer comillas o separadores sueltos. Las líneas reportadas
    suman lo cortado y siguen siendo físicas del archivo original.
  - **Cargo/abono:** monto = abono − cargo, con exactamente uno lleno y sin
    signo. Ambos o ninguno → error de esa fila.
    - El cargo se niega anteponiendo `-` al decimal ya validado. Con
      `dinero.ts` salía `-25000.5` en vez de `-25000.50`: mismo valor, pero
      el texto cambiaba.
  - **Números:** los miles, si el perfil los tiene, van cada tres dígitos
    (`1,23.45` no es número). Con el perfil equivocado, `1.234,56` en
    `banco-norte` se rechaza, no se lee como otra cifra.
  - **Codificación:** UTF-8 con `fatal`. Por eso un archivo de
    `banco-sur` subido sin perfil (cae en `cuadra`) es 400 y no acentos
    rotos.
  - **Un UTF-8 subido con un perfil windows-1252 → 400** ("El archivo
    parece estar en UTF-8; el perfil <id> espera windows-1252").
    windows-1252 decodifica cualquier byte, así que antes entraba con
    acentos rotos ("DepÃ³sito") y sin error. Regla: perfil windows-1252 +
    al menos un byte ≥ 0x80 + UTF-8 válido. No rechaza archivos buenos: un
    windows-1252 real con acentos casi nunca es UTF-8 válido (una `é`
    suelta, 0xE9, sin bytes de continuación, ya no lo es), y uno solo
    ASCII se lee igual en las dos codificaciones.
    - Tests: `banco-sur` guardado en UTF-8 → 400 y cero cargas; el
      original en windows-1252 entra; un windows-1252 solo ASCII entra.
      Este último va con una variante de `banco-sur` con encabezados
      ASCII, porque los de `banco-sur` llevan acentos.
    - **Mutación, con un matiz:** sin la detección, el `banco-sur` en UTF-8
      se pone rojo, pero ya daba 400 por otra razón: su encabezado con
      acentos se leía "operaciÃ³n" y no coincidía, con un motivo confuso.
      El riesgo real es un perfil windows-1252 con encabezados ASCII: ahí
      nada frenaba el archivo. Hay un test de ese caso, y sin la detección
      el archivo **entra**.
  - **`cargas.perfil`** (migración `PerfilDeBanco1790644740503`): los
    estados de cuenta de CU-09 quedan con `'cuadra'`, así un reintento o
    una reanudación los lee igual. Si el JSON de un perfil desaparece con
    una carga en cola, el worker lanza (configuración, no culpa del
    archivo) y termina en `fallida`; resubir la reanuda cuando el perfil
    vuelva.
  - **`GET /bancos/perfiles`:** `{id, nombre}`, cualquier rol con sesión.
  - **Tests:**
    - Unitarios: esquema con 10 formas de romperlo, cargador (JSON roto,
      id ≠ archivo) y un **tercer banco desde un directorio temporal**,
      solo con un JSON nuevo (tabulador, preámbulo, cargo/abono, decimal
      con coma), que se lee sin tocar código.
    - Integración: norte, sur con acentos, el mismo contenido en los tres
      perfiles da los mismos movimientos, cargo y abono llenos, línea con
      preámbulo, perfil inexistente, encabezados de otro banco, sur sin
      perfil y el GET.
  - **Mutaciones** (código restaurado):
    - Sin sumar el preámbulo: 4 rojos.
    - Sin quitar los miles: 5 rojos.
  - **Pendiente, sin resolver:** la idempotencia es por el archivo. El
    mismo CSV subido con otro perfil devuelve la carga original, leída con
    el perfil de entonces.

- **`npm run typecheck` (`tsc --noEmit`).** Lint y build no revisaban los
  tipos de los specs: build los excluye y Jest compila con
  `isolatedModules`, sin revisar tipos. Un error de tipos en un test pasaba
  desapercibido.
  - Único error encontrado: `esquema.spec.ts:46`. `opcionesDataSource`
    estaba tipado como la unión de todos los drivers, y
    `{ ...opcionesDataSource, url }` no compilaba sin cast. Los otros 5
    specs lo tapaban con `as typeof opcionesDataSource`.
  - Arreglo en la raíz: `opcionesDataSource` es `OpcionesPostgres`
    (`Extract<DataSourceOptions, { type: 'postgres' }>`). Los 5 casts
    sobraron y `lint --fix` los quitó.
  - Comprobado que revisa specs: un `.spec.ts` temporal con un error de
    tipos lo hace fallar.
  - `typecheck` entra a la lista de verificación junto a lint, build y
    tests.

- **CU-09, ajuste: un `\0` dentro del CSV rechaza el archivo completo, con
  la línea.** Un byte nulo en un CSV de banco es archivo corrupto, no fila
  malformada. 400 en el POST, antes de guardar nada, con "Línea N: el
  archivo trae bytes nulos". N es la primera línea que lo trae; CRLF
  cuenta como un salto. El contenido guardado no se modifica.
  - Tests: unitarios (LF y CRLF) y de integración (CSV de 3 filas con
    `\0` en la descripción de la línea 3 → 400 con "Línea 3" y cero
    cargas).
  - Mutación: sin la revisión, el POST da 500, porque el INSERT de
    `carga_archivos.contenido` (text) revienta con el byte 0.
  - **Propuesta de continuidad:** reportar el `\0` como error de esa fila,
    con el resto del archivo cargado, requeriría
    `carga_archivos.contenido` en `bytea`. `text` no puede guardar el
    archivo tal cual.

- **CU-09, ajuste: `banco` y `cuenta` se validan en el POST contra su
  columna.** El largo (128 y 32) ya lo validaba el DTO. Faltaba el byte 0,
  que Postgres rechaza en `varchar`: como los dos se guardan en la carga
  durante el POST, un `\0` daba 500. Ahora es 400 con motivo.
  - Tests: los cuatro casos (largo y nulo, por campo) esperan 400, un
    mensaje que nombra el campo, y cero cargas.
  - Cada caso sube un CSV que nunca se había subido. Con uno repetido, la
    idempotencia respondía `yaExistia` antes del INSERT, y el test pasaba
    sin probar nada.
  - Mutación: sin la validación del byte 0, los dos casos de nulo dan 500.
  - 162 tests en verde; lint y build limpios.

- **CU-09 terminado: carga del estado de cuenta.** `POST
  /cargas/estado-cuenta`, formato canónico documentado en la tabla
  `movimientos`.
  - **Verificación:** 159 tests en verde (120 + 28 unitarios del formato +
    11 de integración), estables en dos corridas. Lint sin errores, build
    ok, `migration:generate --check` sin cambios. `docker compose up -d
    --build -V` + `/health` ok, con una carga real: fila 4 reportada y 4
    movimientos con su banco.
  - **Validación en dos niveles:**
    - **El archivo, en el POST, antes de guardar nada:** UTF-8 (con
      `TextDecoder` fatal), sin bytes nulos, CSV bien formado, encabezados
      exactos y al menos una fila. Si falla → 400 y no se crea carga.
    - **Las filas, en el worker:** una malformada es `{fila, resultado:
      'error', motivo}` y el resto entra.
    - El POST parsea el archivo completo: así sabe `total_registros`
      desde el principio (CU-08 lo exige) y un CSV con comillas sin cerrar
      es error del archivo, no de una fila.
  - **Mismo camino que CFDI, reutilizado, no copiado:**
    `CargasService.registrar()` concentra idempotencia, reanudación,
    `carga_archivos` y encolado después del commit. `cargarCfdi` y
    `cargarEstadoCuenta` solo arman lo que cambia (tipo, hash, total,
    archivos).
    - El worker despacha por `cargas.tipo`: `procesarLoteCfdi` o
      `procesarEstadoDeCuenta`.
    - El guard pasó a ser una fábrica (`ArchivosGuard`) con dos
      instancias: XML (500 archivos) y CSV (1 archivo, 10 MB, 2 campos de
      texto).
  - **`linea_numero` = línea física** donde empieza la fila (encabezado =
    1). Una descripción entre comillas puede abarcar varias líneas, y las
    líneas vacías se saltan pero cuentan. Antes la entidad decía "base 0";
    no hubo filas con esa convención.
  - **Trampa de csv-parse 7:** con CRLF dentro de un campo entre comillas
    cuenta cada salto doble, y los números de línea salen corridos. Se
    normaliza CRLF → LF antes de parsear: no mueve ninguna línea física y
    el archivo guardado queda tal cual. Lo detectó el test unitario de
    CRLF.
  - **Sin SAVEPOINT por fila, a diferencia de lo pedido.** `leerMovimiento`
    valida todo lo que la base rechazaría por culpa de la fila: fecha real
    con año ≥ 1, monto ≠ 0 con ≤ 14 enteros y ≤ 4 decimales, largo de la
    referencia. Así, un error de base al insertar siempre es de
    infraestructura, y con la regla de CU-06 aborta el intento completo:
    el savepoint nunca se usaría para seguir. Además costaría dos idas a
    la base por fila. Si se quiere de todos modos, son tres líneas.
  - **`cargas.banco` y `cargas.cuenta`** (migración
    `EstadoDeCuenta1790642871649`, sin GRANTs nuevos): el job solo lleva
    `{cargaId, companyId}`, así que el worker los lee de la carga. Se
    validan con un DTO: máximo 128 y 32, como en `movimientos`. La
    idempotencia es por el archivo: el mismo CSV con otro banco devuelve
    la carga original.
  - **Resultados:** en estado de cuenta solo se listan las filas con
    error. Un CSV de 10 MB trae decenas de miles de filas, y listar las
    buenas inflaría el jsonb sin decir nada.
  - **Decisiones menores:**
    - El monto no acepta `+`: el positivo va sin signo.
    - No se recortan espacios: `" 100"` es monto no numérico.
    - Un archivo con solo el encabezado → 400 ("no trae movimientos").
  - **Tests:** el arranque de la app de cargas pasó a
    `src/cargas/testing/app-de-cargas.ts`, compartido por los specs de
    CFDI y de estado de cuenta.
  - **Mutaciones** (código restaurado):
    - Parsear sin comillas (el equivalente a split por comas): 4 rojos,
      incluida la descripción con comas.
    - Índice de fila en vez de línea física: 5 rojos.
  - **Propuesta de continuidad:** insertar movimientos por lotes (un
    INSERT multi-fila o COPY) en vez de uno por fila. Hoy un CSV de 10 MB
    son decenas de miles de idas a la base dentro de un job.

- **CU-08 terminado: procesamiento en segundo plano.**
  - **Verificación:** 120 tests en verde (110 + 10), estables en dos
    corridas y sin handles abiertos. Lint sin errores (sigue el warning de
    `main.ts:34`), build ok, `migration:generate --check` sin cambios.
    `docker compose up -d --build -V` + `/health` ok, con una carga real por
    la cola: 202 en `pendiente` y `con_errores` 2 s después.
  - **Decisión 1: los archivos en espera viven en Postgres
    (`carga_archivos`), no en Redis.** El job solo lleva `{cargaId,
    companyId}`. Motivo: Redis no tiene persistencia; si reinicia, un job
    con los archivos adentro se pierde y la carga queda en `pendiente` para
    siempre, sin error.
  - **Decisión 2: cinco estados.** `pendiente`, `procesando`, `procesada`,
    `con_errores` y `fallida`.
    - `con_errores` = terminó con al menos un XML inválido.
    - `fallida` = se agotaron los reintentos: es de infraestructura, nunca
      por los XML.
    - Motivo: mezclar las dos cosas escondía una caída del sistema detrás
      de "tus XML venían mal", y al revés. Cambia la regla de CU-07: un lote
      con todos los XML inválidos queda `con_errores`.
    - La migración pasa a `con_errores` las cargas previas con errores,
      incluidas las `fallida` de CU-06/07, que lo eran por sus XML.
  - **POST (sigue síncrono):** límites, roles, hashes e idempotencia de
    lote.
    - Guarda los archivos en `carga_archivos` y crea la carga en
      `pendiente` con `total = N`, todo en la transacción de la petición.
    - Responde **202**; un lote repetido sigue en 200 `yaExistia`, en el
      estado en que esté la original.
  - **Encolar después del COMMIT.** `ContextoEmpresa.alConfirmar()`
    registra acciones que el interceptor corre solo tras el commit, nunca
    si hay rollback.
    - Encolar antes deja que el worker tome el job y no vea la carga.
    - Esa carrera casi no se da en una corrida: la mutación "encolar antes"
      falló solo 1 de ~15 veces. Por eso hay un test determinista que
      espía `encolar()` y comprueba desde otra conexión que la carga ya es
      visible.
  - **Regla: resubir un lote que no terminó lo reencola.** Es la salida
    única para todo lo que puede dejar una carga sin terminar: Redis perdió
    el job, el encolado falló después del commit (la petición respondió 500
    con los datos ya confirmados), el worker murió a media carga, o se
    agotaron los reintentos.
    - `procesada` / `con_errores`: 200 `yaExistia`, sin cambios.
    - `pendiente` / `procesando`: se reencola.
    - `fallida`: vuelve a `pendiente` con contadores, `resultados` y
      `procesada_at` en cero o vacíos, `error_mensaje` en NULL, y se
      reencola. Los XML siguen en `carga_archivos` y el intento fallido no
      dejó CFDI.
    - La respuesta sigue diciendo `yaExistia: true`, con el estado actual.
  - **`jobId` = `cargaId`.** Mientras el job está en espera, en backoff o
    corriendo, reencolar no crea otro, así que nunca se procesa dos veces en
    paralelo.
    - Un job terminado sí bloquearía el id: BullMQ ignora el `add` aunque
      el viejo esté en `failed`. Los completados se borran solos
      (`removeOnComplete`); los fallidos se guardan para diagnosticar
      (`removeOnFail: { count: 1000 }`), así que `encolar()` los quita
      antes de agregar.
  - **Worker (`ProcesadorCargas`)**, en el mismo proceso (D-01). No pasa por
    el interceptor: usa `TransaccionEmpresa`, extraída del interceptor y
    compartida con él, que fija `app.company_id` con el companyId del job
    como `cuadra_app`.
    - (a) Transacción corta que pasa a `procesando`, para que el GET lo
      vea.
    - (b) Todo o nada: savepoints y clasificación de CU-06/07, estado final
      y commit. Si (b) lanza, rollback completo y el reintento empieza
      limpio.
    - Errores por archivo no son fallos del job; todo lo demás sí.
  - **Reintentos:** `COLA_INTENTOS` (5) con backoff exponencial desde
    `COLA_ESPERA_MS` (1000), validados con Zod. En el último intento
    fallido, la carga pasa a `fallida` con un `error_mensaje` genérico; el
    detalle va al log.
  - **`COLA_PREFIJO`**, agregado a lo pedido: los tests usan
    `cuadra_test`. Sin él, el worker de la api en Docker tomaba los jobs de
    los tests y los buscaba en la base de desarrollo.
  - **Migración `ProcesamientoEnCola1790641338024`:**
    - `carga_archivos` con RLS, FORCE, política y `GRANT SELECT, INSERT`,
      sin UPDATE ni DELETE.
    - `ck_cargas_estado` con los 5 estados.
    - `ck_cargas_total_cuadra` exacto solo en `procesada` y `con_errores`;
      en los demás estados, `ok + error + existentes <= total`.
    - El `down` se detiene si hay cargas que no cumplirían la suma exacta
      de CU-07.
    - `carga_archivos` entró a las listas de `esquema.spec` y `rls.spec`,
      que vigilan la regla de CLAUDE.md.
  - **Archivos con byte 0:** `text` no admite NUL, así que `contenido`
    queda NULL y el worker lo reporta como error del archivo, sin tumbar al
    lote. Nombre de archivo de más de 255 caracteres → 400.
  - **Tests** con el Redis del compose:
    - 202 → `procesada`.
    - `con_errores` con motivo, también cuando todos son inválidos.
    - Bytes nulos.
    - Falla de infraestructura en 2 intentos y éxito en el tercero, sin
      duplicados. El trigger falla el **segundo** archivo, así que un
      rollback incompleto dejaría el primero duplicado. La cuenta va en una
      secuencia, porque `nextval` no se revierte.
    - Falla siempre → `fallida` con cero CFDI.
    - RLS en el worker: con A fijada no se escribe un CFDI de B, y un job
      con la empresa B no toca la carga de A.
    - CU-06/07 adaptados: esperan el resultado con poll al GET.
  - **Mutaciones** (código restaurado):
    - Encolar antes del commit → rojo el test del espía.
    - Sin `marcarFallida` → rojo el de `fallida`.
    - Un commit por archivo en vez de (b) todo o nada → rojos los dos de
      reintentos.
    - Sin quitar el job fallido antes de reencolar → rojo el de resubir
      una `fallida`: el jobId viejo bloquea y se queda en `pendiente`.
    - Sin `jobId` → rojo el de "en cola": dos jobs.
    - Sin reencolar `procesando` → rojo el de la carga atorada.
  - **Tests de resubir:**
    - `fallida` → resubir → `procesada`, mismo cargaId, sin duplicados.
    - En cola, con el worker en pausa: un solo job en espera y
      `procesar()` llamado una vez.
    - Atorada en `procesando` sin job, creada a mano → resubir → termina.
  - **Dependencias:** `@nestjs/bullmq`, `bullmq` e `ioredis`. BullMQ 6 la
    trae como peer opcional y sin ella no arranca.
  - **Límite de la regla:** hace falta que alguien resubra. Una carga
    atorada no se destraba sola. Un reconciliador automático tendría que
    leer las cargas de todas las empresas, y RLS hoy no lo permite.
  - **Propuesta de continuidad: limpiar `carga_archivos`.** El XML de cada
    CFDI que entró ya vive en `cfdi.xml_raw`, y `cuadra_app` no tiene
    DELETE, así que el contenido se queda para siempre. Hay que decidir
    cuándo se limpia (al terminar, o tras N días) y con qué permiso, sin
    perder lo que necesita la regla de resubir: mientras una carga no
    termina, sus XML tienen que seguir ahí.

- **CU-07 terminado: carga idempotente.**
  - **Verificación:** 110 tests en verde (101 + 9), estables en dos corridas
    seguidas. Lint sin errores (sigue el warning de `main.ts:34`), build
    ok, `migration:generate --check` sin cambios, `/health` ok.
  - **Lote repetido → 200, no 409.** Mismo hash en la empresa: se devuelve
    la carga **original** (id, estado, contadores, resultados) con
    `yaExistia: true`, y no se crea nada.
    - Se detecta con un `SELECT` antes del `INSERT`, sobre las mismas
      columnas del índice único.
    - Si el índice salta por carrera, la respuesta es la misma. El
      `INSERT` va en su propio SAVEPOINT, porque sin él el 23505 aborta
      la transacción y ya no se podría leer la carga ganadora. En read
      committed la sentencia nueva ya la ve.
  - **El 200 lo pone `YaExistiaInterceptor`**, no `@Res()` en el handler,
    que apagaría los interceptores.
    - Funciona porque Nest 11.2.5 fija el 201 del POST al entrar la
      petición y no lo vuelve a poner al responder. Es un detalle interno;
      el test del 200 lo vigila.
  - **CFDI cuyo UUID ya está en la empresa: `ya_existia`, no error.**
    - Solo el 23505 sobre `ux_cfdi_company_id_uuid_fiscal` cuenta así; el
      resto de las reglas de CU-06 no cambia.
    - Se cuenta en `registros_existentes`.
  - **Estado:** `procesada` si al menos uno quedó en la base, nuevo o de
    antes. `fallida` solo si hubo errores y ninguno entró ni ya existía.
    - Un lote mixto (errores y nuevos) queda `procesada`, como en CU-06.
  - **Resultado por archivo** en la respuesta y en `GET /cargas/:id`:
    `resultados = [{archivo, resultado: 'nuevo' | 'ya_existia' | 'error',
    motivo?}]`, en el orden en que llegaron. Se persiste para que el GET
    lo refleje.
  - **Migración `CargaIdempotente1790640205218`**, con los CHECK a mano:
    - `registros_existentes int NOT NULL DEFAULT 0`, incluido en
      `ck_cargas_conteos_no_negativos`.
    - `ck_cargas_total_cuadra`: `total = ok + error + existentes`.
    - `errores` → `resultados`. Los errores previos se conservan con
      `resultado: 'error'`; de los archivos que entraron antes no quedó
      registro y no se inventan.
    - El `down` devuelve cada `ya_existia` como error con el motivo de
      CU-06 y lo suma a `registros_error`, para que lista y contador
      cuadren. Un `down` + `up` deja esos casos como `error`.
    - Las dos conversiones jsonb se verificaron a mano en una transacción
      revertida: ningún test las ejerce con datos.
    - Sin GRANTs nuevos.
  - **Pendiente para CU-08:** `ck_cargas_total_cuadra` obliga a crear la
    carga con `total_registros = 0` y fijarlo al final junto con los
    contadores. Con la cola, un GET a una carga `procesando` va a mostrar
    total 0, y ese es el caso de "consultar el avance". Para mostrar
    avance real, el CHECK tendría que aplicar solo a `procesada` y
    `fallida`, o `total_registros` tendría que crecer con cada archivo
    procesado.
- **Lector (CU-05): validación de largos.** Todo texto que se persiste en
  una columna con límite se valida contra el menor entre el Anexo 20 y su
  columna, y si no cabe es `CfdiRechazado` con motivo
  `campo_fuera_de_limite`.
  - Textos: Serie 25, Folio 40, Moneda 3, MetodoPago 3, FormaPago 2.
    Cuenta caracteres, no bytes: 25 `Ñ` entran, igual que en `varchar(25)`.
  - Montos: `numeric(18,4)` deja 14 enteros y 4 decimales, y el quinto
    decimal Postgres lo **redondea callado**, sin error. TipoCambio
    `numeric(18,6)` deja 12 enteros. Sin signo.
  - Un test cruza estos límites contra las columnas de la entidad Cfdi
    (`getMetadataArgsStorage`): si alguien achica una columna sin tocar
    el lector, se pone rojo.
- **El test del 500 de CU-06 cambió de disparador.** La Serie de 30 ahora
  la rechaza el lector.
  - Nuevo disparador: un trigger temporal `BEFORE INSERT ON cfdi` que hace
    `RAISE EXCEPTION` (P0001) solo para el UUID del segundo archivo. Se
    crea con el dueño y se borra en `finally`.
  - Es un error real de Postgres con un SQLSTATE que no es del archivo, y
    solo toca a ese archivo, así que el primero sí entra antes del
    rollback.
  - Se descartó revocar el INSERT a `cuadra_app`, porque fallaría también
    el primer archivo, y matar la conexión, porque es frágil.
- **Pruebas de mutación de CU-07** (código restaurado):
  - Sin el `SELECT` previo: 18 verdes, porque la red de seguridad responde
    igual.
  - Sin `SELECT` y sin el SAVEPOINT de la carga: rojos los 2 de lote
    repetido (500).
  - Sin el interceptor: rojos los mismos 2 (201 en vez de 200).
  - Sin `ROLLBACK TO SAVEPOINT` en `ya_existia`: rojos los 2 de "ya estaba
    en la empresa".

- **CU-06 terminado: carga de archivos.**
  - **Endpoints:** `POST /cargas/cfdi` (multipart, campo `archivos`, roles
    admin y contador) y `GET /cargas/:id`.
  - **Verificación:** 101 tests en verde (86 + 15), estables en dos
    corridas seguidas. Lint sin errores (sigue el warning de `main.ts:34`), build
    ok, `migration:generate --check` sin cambios, `docker compose up` +
    `/health` ok y una subida real por la api en Docker.
  - **Una fila en `cargas` por petición.** `hash_archivo` = SHA-256 de la
    lista ordenada de los SHA-256 de cada archivo: el mismo lote en otro
    orden da el mismo hash. Repetido → el índice único salta → 409. El
    resto de la idempotencia es CU-07.
  - **Síncrono dentro de la petición** (la cola es CU-08). Cada archivo pasa
    por `leerCfdi()` y un `INSERT` en `cfdi` con `carga_id`, estado inicial
    y `xml_raw`, **dentro de su propio SAVEPOINT**. Si falla, `ROLLBACK TO
    SAVEPOINT` y sigue con el siguiente.
  - **Estado final:** `procesada` si entró al menos uno, `fallida` si no.
    Contadores y `errores` = `[{archivo, motivo}]`.
  - **Error por archivo solo si es del archivo.** Son dos casos:
    `CfdiRechazado` del lector (su motivo tal cual) y la violación de
    unicidad del UUID (23505 sobre `ux_cfdi_company_id_uuid_fiscal`, "ya
    existe en la empresa"). **Cualquier otro error aborta la petición
    completa**: el interceptor hace rollback de todo, incluida la fila de
    `cargas`, y Nest responde 500. Reportarlo como fallo del archivo
    escondería un problema nuestro detrás de "el CFDI venía mal".
    - Primera versión: todo error contaba como fallo del archivo, con
      motivo genérico. Se corrigió antes del commit.
    - Caso real que hoy da 500: una `Serie` de más de 25 caracteres. El
      lector la acepta y la base la rechaza con 22001. Si se vuelve común,
      la validación de largo va en el lector y pasa a ser motivo del
      archivo.
  - **Fecha:** `fecha_emision` se inserta como texto con `$n::timestamp`.
    Pasarla por `Date` la movería a la zona del servidor.
  - **Migración `CargaDeArchivos1790639046548`:**
    - `cargas.errores jsonb NOT NULL DEFAULT '[]'`.
    - `'parcialidades'` en `ck_cfdi_estado`, escrito **a mano**:
      TypeORM no compara el texto de los CHECK y `migration:generate` no
      lo detecta.
    - Sin GRANTs nuevos: los de tabla cubren la columna nueva.
    - El `down` se detiene si ya hay CFDI en `parcialidades`: decidir a
      qué estado pasan es trabajo de una persona.
  - **Límites con motivo en español:**
    - 400: 2 MB por archivo, 500 por petición, solo `.xml`, al menos uno.
    - **413: 50 MB por petición.** Sin este tope, 500 × 2 MB = 1 GB en
      memoria.
    - El 413 tiene dos capas. Si `Content-Length` pasa el tope, se
      rechaza antes de leer un byte. Si no viene (chunked) o miente,
      cuenta un almacenamiento propio de multer (`memoriaConTope`, como
      `memoryStorage` pero con contador por petición), que corta en
      cuanto la suma pasa el tope.
  - **El multipart se lee en un guard (`ArchivosXmlGuard`) y no con
    `FilesInterceptor`, por el orden:**
    - Los guards globales corren antes, así que un revisor recibe 403 sin
      que se lea el cuerpo.
    - Los interceptores globales corren antes que los del endpoint: con
      `FilesInterceptor`, la transacción de empresa retendría una
      conexión del pool mientras el cliente sube hasta 50 MB.
  - `GET /cargas/:id`: la empresa sale del token, con `WHERE company_id`
    además de RLS. Ajena o inexistente → 404 con cuerpo idéntico. Todo va
    por `ContextoEmpresa`, sin `@Res()` y sin escribir en `bitacora`.
  - **Pruebas de mutación:**
    - **Sin los SAVEPOINT**, se pone rojo exactamente el test del UUID
      repetido: el error de la base aborta la transacción.
    - **Con el controlador leyendo `companyId` de la query**, los 12
      siguen en verde. Lo frena RLS: la empresa fijada sale del token. El
      pendiente de CU-04 queda cubierto como comportamiento, pero **ese
      test no detecta por sí solo un handler que lea la query**; la capa
      que lo detiene es RLS.
    - **Sin el contador del almacenamiento**, se pone rojo solo el 413
      chunked. El de `Content-Length` sigue verde por el atajo del
      header, y por eso el test chunked arma el multipart a mano:
      supertest siempre manda `Content-Length`.
    - **Con los errores desconocidos de vuelta como fallo del archivo**,
      se pone rojo solo el test del 500.
    - Código restaurado en todos los casos.
  - **Tests:** el spec de cargas hace `TRUNCATE cfdi, cargas` al entrar y
    al salir. Si deja un CFDI en `parcialidades`, el `down` de
    `CargaDeArchivos` se detiene y rompe los specs que revierten
    migraciones (`esquema`, `email-normalizado`).
  - **`lint --fix` quita los `as` sobre `query()`** porque cast desde
    `any` le parece innecesario, y luego truena con `no-unsafe-*`. El tipo
    va como genérico: `manager.query<Fila[]>(...)`.
  - Dependencias: `multer` pasa a ser directa (antes solo llegaba por
    Nest) y `@types/multer` en dev.
- **Al agregar dependencias, `docker compose up -d --build -V`**; sin `-V`
  el volumen anónimo de `node_modules` conserva la versión vieja.

- **CU-05 terminado: lector de CFDI 4.0.** Solo el parser, sin endpoints,
  persistencia ni colas. `leerCfdi(xml)` en `src/cfdi/lector-cfdi.ts`,
  tipos en `src/cfdi/cfdi-leido.ts`. 86 tests en verde (67 + 19), lint sin
  errores (sigue el warning de `main.ts:34`), build ok. Dependencias nuevas:
  `fast-xml-parser` y `decimal.js`. La imagen de la api necesita
  `docker compose up --build`.
  - **Montos:**
    - `fast-xml-parser` con `parseTagValue` y `parseAttributeValue` en
      `false`: todo sale como texto y nunca pasa por `number`.
    - La aritmética va por `src/common/dinero.ts`, que envuelve `decimal.js`
      (clone propio, half-up). Solo acepta decimales estrictos:
      `4.46658e3` se rechaza.
  - **Qué devuelve:**
    - Los campos de la tabla `cfdi`. `uuid_fiscal` sale del
      TimbreFiscalDigital, en mayúsculas para que la idempotencia de CU-07
      no dependa del caso.
    - Serie y Folio, opcionales.
    - Impuestos: trasladados, retenidos y los del complemento
      `ImpuestosLocales`, con `'0'` si no hay nodo.
    - `fechaEmision` como texto sin zona, tal cual viene.
    - `xmlRaw` = árbol parseado + `_xml` con el original byte por byte.
  - **Estado inicial:** PUE → `'abierta'`, PPD → `'parcialidades'`.
    **Pendiente para CU-06:** `ck_cfdi_estado` solo admite `abierta`,
    `conciliada` y `cancelada`. La migración que agrega `parcialidades` va
    con la persistencia. `ESTADOS_CFDI` no se tocó: cambiarlo sin
    migración rompería `migration:generate --check`.
  - **Rechazos**, con `CfdiRechazado` y un `motivo` estable que dice cuál
    falló:
    - Versión distinta de 4.0.
    - RFC de emisor o receptor fuera del patrón del SAT (incluye Ñ y &).
    - UUID ausente o mal formado.
    - Las tres sumas: SubTotal = Σ Importe, Descuento = Σ Descuento y
      Total = SubTotal − Descuento + trasladados − retenidos ± locales.
    - Cada suma se redondea a los decimales de la moneda y después se
      compara con igualdad exacta.
    - También: XML mal formado, campos sin formato y moneda sin decimales
      conocidos. La tabla cubre MXN, USD, EUR, CAD, GBP, JPY y XXX; una
      moneda fuera de ella se rechaza en vez de adivinar.
  - **XML con `DOCTYPE` se rechaza antes de parsear.** Un CFDI nunca lo
    trae, y así la expansión de entidades (billion laughs) no depende de
    los límites de la librería.
  - **Fixtures sintéticos** en `src/cfdi/fixtures/`. Todos se generaron
    con RFCs del seed, UUIDs inventados y sellos de relleno:
    - Válidos: PUE, PPD con retención, con descuento, USD con tipo de
      cambio de 6 decimales, Importes de 6 decimales que suman 999.999999
      y cuadran solo al redondear, e impuestos locales.
    - Un fixture por cada rechazo; cada uno rompe una sola cosa.
  - **Prueba de mutación:**
    - Sin el redondeo de Σ Importe, el fixture de 6 decimales se pone rojo.
    - Sin `isArray`, 5 casos rojos: un único `Concepto` llega como objeto y
      no como lista.
    - Código restaurado.
  - **Fuera de alcance, a propósito:** no se valida el sello ni el
    certificado, ni el esquema XSD completo, ni el cruce Σ impuestos de
    conceptos contra los totales. Solo lo que exige el criterio de CU-05.

- **CU-04b terminado: RLS como segunda capa.** Migración
  `AislamientoRls1790636466878`. Las existentes no se tocaron. 67 tests en
  verde (61 + 6), lint sin errores (sigue el warning previo de
  `main.ts:34`), build ok, `migration:generate --check` sin cambios,
  `docker compose up` + `/health` ok, con la api conectada como
  `cuadra_app`.
  - `ENABLE` + `FORCE ROW LEVEL SECURITY` en `cargas`, `cfdi`,
    `movimientos`, `conciliaciones` y `bitacora`. Política `USING` y
    `WITH CHECK` con `company_id = nullif(current_setting('app.company_id',
    true), '')::uuid`. Sin empresa fijada, cero filas. El `nullif` es
    necesario: tras la primera transacción de una conexión el valor queda
    en `''`, no en `NULL`, y `''::uuid` truena.
  - **Rol `cuadra_app`**: `LOGIN NOSUPERUSER NOBYPASSRLS` y sin
    `CREATEDB`/`CREATEROLE`/`INHERIT`/`REPLICATION`. GRANTs:
    - `SELECT` en `companies`, `users` y `user_company_roles`.
    - `SELECT/INSERT/UPDATE` en las cuatro de dominio.
    - `SELECT/INSERT` en `bitacora`.
  - **Sin `DELETE` en ninguna tabla**: nada se borra, se cambia de estado
    (`rechazada`, `descartado`). Si una historia lo pide, va en su
    migración.
  - **El rol es del clúster, no de la base.** `cuadra` y `cuadra_test` lo
    comparten, así que el `up` lo crea solo si no existe y el `down` revoca
    GRANTs y quita políticas, pero nunca hace `DROP ROLE`. Verificado: tras
    el revert completo de `esquema.spec` sobre `cuadra_test`, el rol y sus
    17 GRANTs en `cuadra` siguen intactos.
  - La contraseña de `cuadra_app` no está en el repo: la migración la toma
    de `DATABASE_APP_URL` y la aplica con `format('%L')` en el servidor.
- **Dos conexiones.** `DATABASE_URL` es del dueño (`cuadra`, superusuario en
  Docker) y solo la usan migraciones, seed y la preparación de tests.
  `DATABASE_APP_URL` es la de la app. Zod rechaza que las dos usen el
  mismo usuario: sería correr como superusuario, que ignora RLS aunque
  haya `FORCE`, sin que nada falle.
- **Transacción por petición.** `TransaccionEmpresaInterceptor` es global
  y corre después de los guards. Solo con token de sesión: abre la
  transacción, hace `SELECT set_config('app.company_id', $1, true)`
  parametrizado y corre el handler dentro de un `AsyncLocalStorage`.
  Commit o rollback, y `release` en `finally`. Los handlers piden
  `ContextoEmpresa.manager()`: sin transacción lanza y da 500, no cae al
  pool en silencio. `@Publico` y selección no abren transacción.
  `RolesGuard` y `AuthService` siguen con el pool, sobre tablas sin RLS.
  - **`AsyncLocalStorage` y no `nestjs-cls`**: es una sola clave, y así no
    se suma una dependencia.
  - **La suscripción (`lastValueFrom(next.handle())`) va dentro del
    `run`**, no solo la llamada. Medido: en Nest 11.2.5 envolver solo la
    llamada **también pasa** (5 verdes), porque Nest hace
    `AsyncResource.bind` al llamar `handle()`. Se deja la suscripción
    dentro para no depender de ese detalle interno. Control: sin ALS, 4 de
    5 en rojo con 500 ("Sin transacción de empresa").
- **Tests nuevos** (`src/database/rls.spec.ts`, contra la base, sin la app):
  - Como `cuadra_app` y sin empresa, `SELECT * FROM cargas` da cero filas.
    Antes comprueba con el dueño que hay al menos 2, para que el cero
    pruebe algo.
  - Con Ferretería fijada ve exactamente su empresa.
  - Un `INSERT` con el `company_id` de Transportes falla por RLS.
  - La empresa no sobrevive al `COMMIT` en la misma conexión: es el caso
    del pool.
  - Atributos del rol y flags de RLS/FORCE en las 5 tablas.
- **Prueba de mutación.** Sin el `AND company_id = $2` en el handler de
  `aislamiento.spec.ts`, **los 5 casos de CU-04 siguen en verde** gracias a
  RLS. Contraprueba: la misma mutación con la app conectada como `cuadra`
  (superusuario) pone 3 en rojo. Es RLS quien los salva. Handler
  restaurado.
- **Ajustes a tests existentes.**
  - `email-normalizado.spec` revertía "la última migración" dando por hecho
    que era la suya. Ahora revierte hasta `EmailSinMayusculas` incluida.
  - `auth.integracion.spec` borraba roles con la conexión de la app. Ahora
    prepara datos con la del dueño.
  - Las apps de prueba corren como `cuadra_app` (`urlAppDePruebas()`).
- **Regla nueva en `CLAUDE.md`:** toda tabla de dominio nueva lleva
  `company_id`, RLS con FORCE y su política, y GRANTs explícitos para
  `cuadra_app` en la misma migración. No hay `ALTER DEFAULT PRIVILEGES`
  a propósito: una tabla nueva sin su GRANT falla ruidoso, no queda
  abierta.

### 24 sep 2026

- **Refactor: estructura por módulos de dominio.** Sin cambios de esquema,
  endpoints ni comportamiento; `migration:generate --check` sin cambios.
  61 tests antes y 61 después. Entidades junto a su dominio (`users/`,
  `companies/`, `cargas/`, `cfdi/`, `bancos/`, `conciliacion/`,
  `bitacora/`), base y tipos en `common/entities/`, decoradores en
  `common/decorators/`, lista explícita de entidades en
  `database/entidades.ts`. Specs junto a lo que prueban;
  `tsconfig.build.json` los excluye de `dist/`.
  - Rutas que cambiaron y que citan entradas anteriores:
    `src/database/__tests__/aislamiento.spec.ts` →
    `src/database/aislamiento.spec.ts`;
    `src/database/__tests__/base-de-pruebas.ts` →
    `src/database/testing/base-de-pruebas.ts`; `src/database/entities/*`
    → carpeta de su dominio; `src/auth/email.ts` → `src/users/email.ts`
    (normaliza el email del usuario y también lo usa el seed);
    `src/auth/decoradores.ts` → `src/common/decorators/decoradores.ts`.
  - **Previos, no del refactor:** `npm run lint` falla en
    `src/auth/password.ts` (cast innecesario, commit `b386a5b`).
    `docker compose up` falla con `EBUSY rmdir '/app/dist'`
    (`deleteOutDir` contra el volumen `/app/dist`); `/health` responde ok
    con `node dist/main`. Esto rompe el criterio de CU-01 y se corrige en
    el commit siguiente.
- **CU-01 restaurado: `docker compose up` vuelve a levantar la api.** Causa:
  el volumen anónimo `/app/dist` que agregó `b386a5b` choca con
  `deleteOutDir: true` (`EBUSY rmdir '/app/dist'`). Arreglo: se quita ese
  volumen y la api corre con `user: node` (uid 1000), para que lo que el
  watch escribe en `./dist` del host no quede con dueño root.
  `deleteOutDir` no cambia. Verificado con `down -v` + `up --build`:
  `/health` ok, `npm run build` en el host sin sudo, 61 tests en verde.
- **Lint sin errores.** En `src/auth/password.ts`, el cast
  `promisify(scrypt) as (...)` de `b386a5b` pasa a ser una anotación de
  tipo en `scryptAsync`. Con el cast, `--fix` lo borraba y el tipo quedaba
  sin resolver (`no-unsafe-call`). Queda un warning previo en `main.ts:34`
  (`no-floating-promises`). Build ok, 61 tests en verde.
- **CU-04 terminado. Épica A cerrada (16 de 16 pts).** Escrito a mano.
  `src/database/__tests__/aislamiento.spec.ts`, 5 casos contra la app
  levantada por HTTP, con los guards globales reales (nada de
  `overrideGuard` ni llamadas directas al controlador). 61 tests en verde.
  - Carga ajena → 404, **con el cuerpo idéntico al de una carga que no
    existe**. Si fueran distintos, con un token válido se podría averiguar
    qué UUIDs existen en otras empresas. Es el mismo principio que el 401
    único del login.
  - Jorge con token de Ferretería no ve la carga de Transportes aunque
    pertenezca a las dos: **manda el `companyId` del token, no la persona.**
  - Token de selección contra dominio → 401.
  - **Control positivo:** Jorge con token de Transportes sí ve la suya →
    200. Sin este caso, un aislamiento que bloquea todo (por ejemplo, RLS
    sin la empresa fijada) dejaría los otros cuatro en verde.
  - **Precisión sobre qué protege qué:** el 404 lo da el handler, que
    filtra por el `companyId` del token. Los guards deciden quién eres y en
    qué empresa estás, pero no saben nada de cargas. Hoy el aislamiento
    depende de que cada handler escriba ese `WHERE`, y esa es la razón de
    ser de CU-04b.
  - **Prueba de mutación:** con la comprobación del scope quitada a
    propósito de `JwtAuthGuard`, el caso 4 se puso rojo (500 en vez de 401)
    y los otros cuatro siguieron verdes. Antes, el handler de prueba
    respondía su propio 401 y **tapaba al guard**: el test habría pasado
    con el guard roto. Ahora, si el guard deja pasar un scope equivocado, el
    handler lanza un `Error` que da 500. Regla: un test que nunca has visto
    fallar no sabes si funciona.
- **Pendiente para CU-06:** el caso 3 (`companyId` en la query se ignora)
  hoy no puede fallar, porque el controlador de prueba nunca lee
  `@Query()`. El riesgo real es un handler de producción que sí lo lea, y
  eso solo se prueba contra el endpoint real de cargas.
- **Pendiente, CU-04b (RLS), 25 sep:** segunda capa sobre `cargas`, `cfdi`,
  `movimientos`, `conciliaciones` y `bitacora`, con `FORCE ROW LEVEL
  SECURITY`, el rol `cuadra_app` sin `BYPASSRLS` y `SET LOCAL
  app.company_id` dentro de una transacción por petición. Quedan fuera
  `companies`, `users` y `user_company_roles`: esta última se consulta antes
  de elegir empresa, y una política sobre ella bloquearía el login. El
  test de CU-04 detecta un RLS demasiado restrictivo, pero **no** uno que no
  haga nada; eso necesita un test propio: una consulta sin `WHERE` con el
  rol de la app que tiene que devolver cero filas. Ojo: en Docker, `cuadra`
  es superusuario y el superusuario ignora las políticas incluso con
  `FORCE`.

### 23 sep 2026

- **CU-03 terminado.** Login en dos pasos según D-09: `POST /auth/login`
  devuelve token de selección (5 min) y la lista de empresas sin duplicar;
  `POST /auth/empresa/:id` lo canjea por uno de sesión (15 min, con
  `companyId`) solo si el usuario tiene roles vigentes ahí. `GET
  /auth/empresas` repite la lista para cuando el front recarga y la pierde.
  56 tests en verde.
  - **`JwtAuthGuard` y `RolesGuard` son globales**, con `@Publico()` para las
    excepciones (`/health`, `/docs`). Mismo criterio que el default del
    `expiresIn`: si fueran por endpoint, olvidarse dejaría la ruta abierta;
    siendo globales, olvidarse la deja cerrada. La falla tiene que ser
    ruidosa.
  - Sin `@Scope` se exige el token de sesión. El restrictivo es el default.
  - **El guard rechaza tokens sin `exp` y fija el algoritmo en `HS256`.** Lo
    primero es la segunda capa contra el token eterno de D-09. Lo segundo
    cierra el ataque de `alg: "none"`, donde un token sin firma pasa como
    válido si la librería acepta el algoritmo que le dicta el header.
  - Los roles se leen de `user_company_roles` en cada request, filtrando
    además por usuario y empresa activos. Revocar un rol o desactivar a
    alguien surte efecto con el mismo token, en la siguiente petición.
  - **Unicidad de email sobre `lower(email)`**, con migración que normaliza
    lo existente y se detiene si dos correos chocan al normalizarse — sin
    escribir cuáles en el log, porque son datos personales y los logs se
    guardan. Trampa que dejó: `ON CONFLICT (email)` del seed deja de inferir
    índice al quitar el `UNIQUE` plano; va sobre `lower(email)`.
  - Swagger en `/docs`, nunca con `NODE_ENV=production`.
  - **Los tests corren contra `cuadra_test`**, una base aparte que se crea
    sola (`urlDePruebas()` en `src/database/__tests__/base-de-pruebas.ts`).
    Hace falta porque las pruebas de esquema revierten todas las migraciones:
    apuntando a la base de desarrollo, un `npm test` borraría los datos
    cargados a mano para probar.
- **CU-03 paso 1, escrito a mano** (sin agente, a propósito, para verificar
  que el módulo de auth se entiende de arriba a abajo). Paso 1 de 8 cerrado:
  `POST /auth/login` valida credenciales y responde 200 / 401.
  - `PasswordHasher` con `scrypt` **asíncrono** (`promisify`, no `scryptSync`:
    el síncrono bloquea el event loop ~100 ms por login) y `timingSafeEqual`
    para comparar el hash.
  - **Hash señuelo** contra enumeración de usuarios: si el email no existe se
    verifica igual contra un hash falso, así los dos caminos cuestan lo mismo.
    Medido en Postman: 33 ms (usuario inexistente) vs 39 ms (contraseña mala).
    Mismo mensaje 401 en ambos casos.
  - Detalle deliberado: el 400 de validación **sí** dice qué campo falta —
    el contrato de la API es público. El 401 **no** dice cuál de los dos
    falló.
- **D-09 registrada:** dos tokens, selección 5 min y sesión 15 min.
- **Corrección de rumbo (yo tenía razón, el asistente no):** se propuso
  quitar `signOptions: { expiresIn }` del `JwtModule` para forzar que cada
  firma pusiera el suyo. Se descartó: sin default, un `sign()` al que se le
  olvide el `expiresIn` emite un token **sin `exp`** que no caduca nunca, y
  `verify()` lo acepta. Se cambia un error molesto por un hueco silencioso.
  El default se queda corto, cada firma pasa el suyo explícito, y hay un test
  por tipo de token que decodifica el `exp`.

### 22 sep 2026

- **CU-02 terminado.** Ocho entidades, migración inicial aplicada y seed con
  dos empresas, cuatro usuarios y cinco roles. Tres decisiones de esquema que
  vale la pena conservar, todas encodadas en constraints y no en código:
  - Índices únicos parciales en `conciliaciones`: a lo más una fila
    `'confirmada'` por CFDI y por movimiento, con varias propuestas
    conviviendo. Es "un falso positivo es peor que no conciliar" en el
    esquema.
  - `CHECK ck_conciliaciones_confirmada_requiere_persona`: pasar a
    `'confirmada'` exige `confirmada_por_id` y `confirmada_at`. La IA no
    puede cerrar un caso aunque el código lo intente.
  - Idempotencia de movimientos por `(company_id, carga_id, linea_numero)`,
    no por hash del contenido: dos cargos legítimos pueden ser idénticos el
    mismo día.

  **Trampa de infraestructura, para no repetirla:** las imágenes
  `postgres:18+` guardan los datos en una ruta con número de versión. El
  volumen se monta en `/var/lib/postgresql`, **no** en
  `/var/lib/postgresql/data`; con la ruta vieja el contenedor sale con
  código 1 y todo lo demás falla con `ECONNREFUSED`.

  **Lección de método:** la primera corrida del agente no encontró
  `CUADRA.md` porque el archivo no estaba en el repo todavía, y generó el rol
  `auditor` en vez de `revisor`. El contexto solo sirve si está versionado.
- **CU-01 terminado.** `docker compose up` levanta api, postgres y redis;
  `/health` responde `{"status":"ok"}` con Postgres en ~11 ms. Stack
  confirmado: NestJS 11, Node 22, Postgres 17, Redis 7, validación de `.env`
  con Zod y health check con `@nestjs/terminus`.
  Nota para quien retome esto: `DATABASE_URL` usa `@postgres:5432` dentro de
  Docker y `@localhost:5432` al correr con `npm run start:dev`.
- **Jira poblado.** Proyecto `KAN`. Épicas `KAN-73`…`KAN-77`, historias
  `KAN-78`…`KAN-95` (CU-01 = KAN-78, CU-18 = KAN-95), más 64 subtareas.
  La importación va en tres pasos porque este Jira es *team-managed*: solo
  tiene el campo "Principal" y exige claves reales, así que las historias
  deben existir antes de crear sus subtareas o vincularlas a las épicas.
  Formato de fecha del importador: `yyyy-MM-dd`, sin hora.
- **Sin subtareas en Jira.** Tres intentos de importarlas fallaron con el
  mismo error (`doesn't have a valid Parent selection`), con IDs internos y
  con claves reales: el proyecto Kanban no acepta subtareas por CSV. Las 64
  tareas viven ahora como checklist dentro de la descripción de su historia.
  El tablero queda en 23 issues, que es lo que un proyecto de 9 días puede
  leer sin ruido.
- **CSV de Jira completo.** 87 filas: 5 épicas, 18 historias y 64
  subtareas, con `Issue ID`/`Parent ID` para la jerarquía y columnas
  `Link "blocks"` para las dependencias entre historias. Las subtareas
  heredan la fecha de su historia.
- **Cadena de dependencias definida.** CU-01 → CU-02 → CU-03/04 → CU-05 →
  CU-11 → CU-12/13/14 → CU-15/17. CU-11 es el cuello de botella: depende
  de CU-05, CU-08 y CU-10, y desbloquea cuatro historias.
- **Historias exportadas a Jira.** CSV con 5 épicas y 18 historias, con
  `Start date`, `Due date`, story points y etiqueta `dia-N`. Formato de
  fecha del importador: `yyyy-MM-dd`.
- **Carga rebalanceada.** Al asignar fechas salió que el último día llevaba
  14 puntos y el primero 3. Redistribuido a 5–10 puntos por día.
- **D-06: PostgreSQL sobre MySQL.** Decidido.
- **D-05: roles por empresa.** Tabla `user_company_roles` en vez de un
  campo `rol` en `users`.
- **Alcance confirmado en 2 semanas.** El proyecto entrega el 2 de octubre.
  Lo que estaba como "fase 2" pasa a ser propuesta de continuidad.
- **Roadmap reescrito como historias de usuario.** 18 historias en 5
  épicas, con criterios de aceptación en formato EARS.
- **Recorte de alcance de 4 meses a 9 días.** D-01, D-02, D-03, D-04.
  Origen: la propuesta original planteaba microservicios, MinIO,
  observabilidad y extracción de PDF con IA en un cronograma de 4 meses.
