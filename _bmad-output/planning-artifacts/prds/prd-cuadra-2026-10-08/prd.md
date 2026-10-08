---
title: "Cuadra v2 — PRD"
status: draft
created: 2026-10-08
updated: 2026-10-08
---

# PRD: Cuadra v2

## 0. Propósito del documento

Este PRD es la guía de producto de Cuadra v2 para el dueño de Cuadra y su equipo, y la entrada de los pasos siguientes de BMAD: UX, arquitectura, épicas e historias. Se construye sobre el resumen de producto (`_bmad-output/planning-artifacts/briefs/brief-cuadra-2026-10-08/`) y sobre el análisis de la v1 (`_bmad-output/planning-artifacts/analisis-v1.md`), y no los duplica. `CUADRA.md` sigue siendo la fuente de verdad de lo que la v1 ya hace; donde este PRD decide distinto, la sección 11 lo señala.

El vocabulario está anclado en el Glosario (sección 3). Las funciones agrupan sus requisitos con identificadores globales estables (FR-1 a FR-70). Lo inferido sin confirmación lleva la marca **[SUPUESTO]** y se recoge en el índice de la sección 10.

## 1. Visión

Cuadra concilia las facturas CFDI con los movimientos del estado de cuenta bancario. La v1 demostró que el motor de reglas, la bandeja de revisión y la bitácora funcionan, pero con datos sintéticos y con una persona confirmando cada caso, uno por uno.

La v2 lleva ese motor a uso real. Lee los estados de cuenta en PDF del portal de BBVA, Banorte y Santander, resuelve el pago que cubre varias facturas, permite confirmar en lote lo que el sistema propone con evidencia fuerte y deja que cada empresa gestione a sus propios usuarios. Todo con la regla de siempre: un falso positivo es peor que no conciliar.

La meta es una sola: **que un contador concilie un mes en horas, no en días.**

## 2. Usuarios

### 2.1 Trabajos por hacer

- **Contador:** conciliar el mes de una empresa sin pasar una mañana con dos ventanas abiertas, y poder demostrar después qué decidió y por qué.
- **Revisor:** comprobar, antes de cada cierre, que lo conciliado es confiable, sin llevar la contabilidad ni cargar archivos.
- **Administrador de empresa:** dejar la empresa lista, dar acceso a su gente con el rol correcto y quitarlo cuando alguien se va.
- **Auditor (cliente):** ver, sin poder cambiar nada, qué se concilió y quién lo decidió.
- **Dueño de Cuadra:** incorporar clientes verificados, y decidir con datos cuándo es seguro dejar que Cuadra cierre casos sola.

### 2.2 No usuarios (v2)

Quien busca facturación, contabilidad completa o pólizas; quien trabaja con estados de cuenta escaneados o en moneda distinta de MXN; quien espera registrarse por su cuenta sin pasar por el dueño de Cuadra.

### 2.3 Recorridos de usuario

- **UJ-1. Marisol concilia el mes de una empresa.**
  - **Persona y contexto:** contadora de un despacho en Aguascalientes que lleva la contabilidad de tres empresas. Trabaja en una empresa donde el dueño de Cuadra desactivó la separación de funciones (FR-23); en las demás empresas confirma una persona distinta de quien subió la carga.
  - **Estado de entrada:** con sesión iniciada, el segundo día hábil del mes, a las 9, en su oficina.
  - **Recorrido:** elige la primera empresa. Sube el PDF del portal del banco (por ejemplo BBVA) y elige el banco. En segundos la carga aparece procesada, con el número de movimientos cargados. Sube los CFDI del mes. La bandeja se ordena por confianza: arriba van las propuestas más confiables, con factura, movimiento, diferencia y motivo. Las propuestas de la regla 1 vienen marcadas; Marisol desmarca la que no le convence y confirma el lote. Las demás propuestas, y los depósitos que cubren varias facturas, vienen desmarcados y los revisa una por una. Descarta los movimientos que no son de ningún cliente (comisiones, intereses).
  - **Clímax:** de unos 180 movimientos, cerca de 144 llegan con propuesta correcta. El lote se confirma en minutos; antes era una mañana entera.
  - **Resolución:** el mes de la empresa queda conciliado en horas y pasa a la siguiente empresa.
  - **Casos de falla:** un PDF que no cuadra con el saldo se rechaza completo, con el motivo y las líneas que no se pudieron leer. Una factura en dólares queda en la bandeja con la nota "moneda no soportada". Si confirma algo por error, lo reabre (o reabre el lote entero) con un motivo, y queda registrado quién y cuándo.

- **UJ-2. Carlos deja lista la empresa de su despacho.**
  - **Persona y contexto:** responsable de un despacho que busca dónde validar los CFDI contra los estados de cuenta de sus contadores.
  - **Estado de entrada:** aún no tiene cuenta. Contacta a Cuadra por fuera de la aplicación.
  - **Recorrido:** el dueño de Cuadra lo verifica, crea su empresa con el RFC ya comprobado y le envía una invitación. Carlos abre el correo, fija su contraseña y entra. En Administración ve la lista de usuarios (solo el administrador la ve) e invita a tres personas con su rol; ellas aceptan por correo.
  - **Clímax:** su menú muestra usuarios, cargas, tolerancia, bitácora y bandeja, y su equipo ya puede trabajar.
  - **Resolución:** Carlos administra a su gente sin intervención del dueño.
  - **Casos de falla:** una invitación que no llega queda "pendiente" y se reenvía (el enlace anterior deja de servir) o se cancela. Todo enlace caduca. La contraseña olvidada se recupera por correo. Si una contadora deja el despacho, Carlos le quita el rol y ella conserva sus otras empresas. Un RFC ya existente lo resuelve el dueño. El único administrador no puede irse hasta que haya otro **[SUPUESTO]**.
  - **Nota:** el dueño de Cuadra hace todo esto desde una pantalla interna de la aplicación (FR-67), con un rol de plataforma separado de los roles de empresa. Su recorrido completo se escribirá en el paso de UX.

- **UJ-3. Pedro controla que el mes sea confiable.**
  - **Persona y contexto:** responsable del control interno de la empresa; no lleva la contabilidad ni sube archivos.
  - **Estado de entrada:** antes de cada cierre de mes, con su propia cuenta de revisor.
  - **Recorrido:** elige la empresa y ve un menú corto: bandeja y bitácora. En la bandeja revisa lo que sigue sin resolver y frena el cierre: depósitos con varias facturas y casos sin propuesta, con sus candidatos y su explicación. Verifica la muestra del mes (FR-63): propuestas de la regla 1 ya confirmadas en lote, que contrasta una por una con la factura y el movimiento. Después recorre la bitácora del mes.
  - **Clímax:** confía porque cada decisión tiene persona, fecha y regla, y nada se puede modificar ni borrar desde la aplicación.
  - **Resolución:** da el visto bueno al cierre.
  - **Casos de falla:** una propuesta dudosa la rechaza (el par queda rechazado y la factura sigue abierta). Una confirmación ajena que no le convence no la puede editar ni reabrir: deja un comentario sobre el caso (FR-68) y la contadora decide. Si una carga se rechazó, no la ve; se lo pregunta a la contadora.

## 3. Glosario

- **Empresa:** entidad cliente de Cuadra, con un RFC único. Todos sus datos están aislados de las demás empresas.
- **Usuario:** persona con cuenta en Cuadra. Pertenece al sistema, no a una empresa; puede tener uno o más roles en cada empresa y roles distintos en empresas distintas **[SUPUESTO: sigue vigente el diseño de la v1, D-05 y D-08]**.
- **Dueño de Cuadra:** quien opera la plataforma; verifica y da de alta empresas, y controla los ajustes que ninguna empresa puede cambiar. Lo hace desde una pantalla interna (FR-67).
- **Rol:** permiso de un usuario dentro de una empresa. Hay cuatro: `admin`, `contador`, `revisor` y `auditor`.
- **Auditor:** rol de solo lectura (bandeja y bitácora); no confirma, rechaza, reabre ni descarta.
- **CFDI:** factura electrónica en XML, versión 4.0.
- **Estado de cuenta:** archivo del banco con los movimientos de un periodo (PDF del portal o CSV).
- **Movimiento:** una línea del estado de cuenta; un abono o un cargo.
- **Carga:** acto de subir un archivo; guarda su resultado.
- **Huella del movimiento:** identificador calculado con la cuenta, la fecha, el monto y la referencia o descripción normalizada; sirve para detectar movimientos repetidos entre archivos (FR-65).
- **Banco:** institución cuyo formato Cuadra sabe leer; en la v2: BBVA, Banorte y Santander.
- **Cuadre de saldos:** comprobación de que saldo inicial + abonos − cargos = saldo final en un estado de cuenta en PDF.
- **Vista previa:** pantalla donde la persona ve lo que el sistema leyó de un PDF antes de conciliar.
- **Tolerancia:** diferencia de monto, configurada por empresa, que el motor admite entre una factura y un movimiento. Solo aplica en MXN y solo la edita el administrador.
- **Propuesta:** par propuesto por Cuadra (un movimiento con una o varias facturas), con su regla y su nivel de confianza. No está cerrado.
- **Regla:** criterio que origina una propuesta. Regla 1: referencia y monto exactos. Regla 2: referencia con monto diferente. Regla 3: monto único, sin referencia.
- **Nivel de confianza:** orden de una propuesta en la bandeja; coincide con la puntuación de su regla (regla 1 la más alta, luego la regla 2, luego la regla 3). Los depósitos con varias facturas se ordenan después de la regla 1 y vienen desmarcados **[SUPUESTO]**.
- **Propuesta correcta:** propuesta confirmada por una persona y no reabierta durante el mes.
- **Caso:** un movimiento por resolver en la bandeja.
- **Bandeja:** lista ordenada de casos y propuestas pendientes.
- **Lote:** grupo de propuestas confirmadas a la vez; tiene un identificador.
- **Confirmación:** decisión de una persona que cierra una propuesta.
- **Rechazo:** decisión de una persona que descarta una propuesta; ese par no se vuelve a proponer.
- **Descarte:** decisión de una persona de que un movimiento no corresponde a ningún cliente; lleva motivo y se puede deshacer (FR-21).
- **Reapertura:** deshacer una confirmación, con motivo; el caso vuelve a estar pendiente.
- **Separación de funciones:** regla que impide que quien subió una carga confirme sus conciliaciones.
- **Bitácora:** registro inmutable de las decisiones y los cambios.
- **Modo sombra:** mecanismo que registra qué propuestas de la regla 1 Cuadra habría cerrado sola, sin cerrar nada.
- **Muestreo de verificación:** revisión mensual, uno por uno, de una muestra al azar de propuestas de la regla 1 ya confirmadas en lote (FR-63).
- **Tasa de desacuerdo:** proporción de propuestas de la regla 1 con las que la persona no estuvo de acuerdo (ver FR-35 y FR-63).
- **Invitación:** mensaje por correo, de un solo uso y con caducidad, que da acceso a una empresa con un rol.

## 4. Funciones

### 4.1 Cargas (F1)

**Descripción:** el contador o el administrador sube los estados de cuenta y los CFDI de una empresa. El estado de cuenta en PDF del portal del banco es el formato principal; el CSV se conserva como secundario. Realiza UJ-1.

#### FR-1: Cargar un estado de cuenta en PDF del portal
El contador o el administrador sube el PDF descargado del portal del banco y elige el banco a mano. BBVA es el primero.
**Consecuencias (verificables):**
- Solo se aceptan PDF con texto; el tamaño máximo es de 10 MB **[SUPUESTO: igual que la v1]**.
- Solo se aceptan estados de cuenta de cuentas empresariales; el diseño del PDF cambia según el tipo de cuenta y las cuentas personales quedan fuera de la v2.
- Al terminar, la carga muestra cuántos movimientos entraron.
- Un estado de cuenta que no está en MXN se rechaza con el motivo **[SUPUESTO]**.

#### FR-2: Cuadre de saldos
Si saldo inicial + abonos − cargos no es igual al saldo final, la carga se rechaza completa.
**Consecuencias:**
- El mensaje indica el motivo y las líneas que no se pudieron leer.
- No se crea ninguna carga ni movimiento a medias.

#### FR-3: Vista previa obligatoria por banco
Hasta que el dueño de Cuadra la levante para ese banco, cada carga en PDF muestra primero lo que el sistema leyó, y no se concilia hasta que una persona lo acepta.
**Consecuencias:**
- La obligación se cuenta por banco en todo Cuadra, no por empresa.
- Cinco cargos revisados por banco son la evidencia mínima antes de levantarla **[SUPUESTO]**.
- La obligación no se levanta sola; solo el dueño de Cuadra la levanta, desde la pantalla interna (FR-67).

#### FR-4: Cargar un estado de cuenta en CSV
Se conserva el comportamiento de la v1 (CU-09).
**Consecuencias:**
- Una falla del archivo (extensión, codificación, encabezados, CSV mal formado) rechaza la carga completa con el motivo.
- Una fila mala se reporta como `{fila, motivo}` y el resto se carga; la carga queda marcada "con filas rechazadas".

#### FR-5: Cargar CFDI
El contador o el administrador sube los CFDI del mes en XML.
**Consecuencias:**
- Un CFDI en una moneda distinta de MXN se acepta, pero queda marcado "moneda no soportada".

#### FR-6: Idempotencia
Subir dos veces el mismo archivo en la misma empresa no duplica nada.
**Consecuencias:**
- La segunda carga responde que ya existía y no crea movimientos ni CFDI nuevos.
- Dos archivos distintos que cubren el mismo periodo se resuelven con FR-65.

#### FR-7: Rechazar un PDF escaneado
Un PDF sin texto o escaneado se rechaza.
**Consecuencias:**
- El mensaje pide el PDF descargado del portal del banco.

#### FR-8: Historial de cargas
La persona ve la lista de cargas de la empresa con su estado.

#### FR-9: Quién carga
Solo el `admin` y el `contador` cargan archivos; el revisor y el auditor no ven Cargas.

#### FR-65: Duplicados entre archivos
Cuando dos archivos distintos cubren el mismo periodo (un PDF y un CSV del mismo mes, o periodos que se traslapan), Cuadra detecta los movimientos repetidos por su huella y la persona confirma antes de importar.
**Consecuencias:**
- La huella del movimiento se calcula con la cuenta, la fecha, el monto y la referencia o descripción normalizada.
- Antes de importar, la carga muestra un resumen ("N nuevos, M ya existentes") que la persona confirma.
- Ante un empate dudoso no se descarta nada: el movimiento se importa como pendiente de revisión. Perder un movimiento real es peor que ver uno repetido.

### 4.2 Propuestas (F2)

**Descripción:** el motor de reglas propone pares y la IA solo sugiere. Cuadra nunca cierra un caso por sí misma en la v2. Realiza UJ-1.

#### FR-10: Proponer un par de una factura y un movimiento
Cuadra propone un movimiento con una factura y muestra la regla que lo originó.

#### FR-11: Proponer un depósito con varias facturas
Cuadra propone un movimiento con varias facturas solo cuando el subconjunto es único.
**Consecuencias:**
- Las facturas corresponden al mismo cliente y su suma admite la tolerancia de la empresa (la misma de la v1, CU-12); si queda fuera de tolerancia, no se propone.
- Una propuesta de este tipo nunca se cierra sola.
- El modelo de la v1 permite una sola confirmación por movimiento; esto cambia (sección 11).

#### FR-12: No proponer ante varias combinaciones
Si varias combinaciones de facturas suman el mismo monto, Cuadra no propone.
**Consecuencias:**
- El caso va a la bandeja con candidatos y una explicación de por qué es ambiguo.

#### FR-13: Solo MXN
Un CFDI en otra moneda no se empata.
**Consecuencias:**
- Queda en la bandeja con el motivo "moneda no soportada".

#### FR-14: Un par rechazado no vuelve
Un par rechazado no se vuelve a proponer.

#### FR-15: Cuadra no cierra casos
El motor y la IA solo producen propuestas; únicamente una persona confirma.

#### FR-16: Nivel de confianza
Cada propuesta lleva un nivel de confianza, y la bandeja se ordena por él (definición en el Glosario).

#### FR-64: Sugerencias de la IA
En los casos ambiguos la IA puede sugerir candidatos y explicar por qué el caso es ambiguo.
**Consecuencias:**
- Una sugerencia de la IA nunca cierra un caso ni queda marcada.
- Si el proveedor de IA falla, el caso cae en la bandeja sin sugerencia.

#### FR-66: CFDI cancelado
Si el XML o un dato cargado indica que un CFDI está cancelado, la factura pasa al estado `cancelada`.
**Consecuencias:**
- Una factura cancelada sale de las propuestas.
- Si ya estaba conciliada, el caso se marca para revisión humana; Cuadra nunca lo reabre sola.
- Cuadra no consulta al SAT para saberlo (sección 6).

### 4.3 Bandeja y revisión (F3)

**Descripción:** la persona revisa la lista ordenada, confirma lo que está bien en lote y resuelve a mano el resto. Realiza UJ-1 y UJ-3.

#### FR-17: Bandeja ordenada por confianza
La bandeja se ordena por confianza y muestra factura, movimiento, diferencia y motivo.

#### FR-18: Lote con la regla 1 marcada
En el lote solo las propuestas de la regla 1 vienen marcadas.
**Consecuencias:**
- Las propuestas de las reglas 2 y 3 aparecen desmarcadas.
- Los depósitos con varias facturas aparecen siempre desmarcados.

#### FR-19: Confirmar en lote
La persona desmarca lo que no le convence y confirma el lote.
**Consecuencias:**
- Cada confirmación queda con persona, fecha y regla.
- La confirmación en lote no pide motivo: basta con la regla que la originó. El motivo se exige en la reapertura (FR-26).

#### FR-20: Confirmar o rechazar un caso individual
La persona confirma o rechaza un caso, con candidatos y explicación.

#### FR-21: Descartar un movimiento
La persona descarta un movimiento que no es de ningún cliente (comisiones, intereses).
**Consecuencias:**
- El descarte lleva un motivo obligatorio, porque saca al movimiento del denominador de SM-2.
- Se puede deshacer; el movimiento vuelve a la bandeja como pendiente **[SUPUESTO: lo deshace quien lo descartó o el `admin`, igual que la reapertura]**.
- Descartar y deshacer un descarte quedan en la bitácora con persona, fecha y motivo.

#### FR-22: Separación de funciones activa por defecto
Quien subió una carga no puede confirmar sus conciliaciones.
**Consecuencias:**
- Se compara a quien confirma con quien subió la carga del CFDI o la del movimiento.
- La regla está activa por defecto y falla cerrada: si la configuración falta o falla, se aplica.
- Hay pruebas en los dos modos (activa y desactivada).

#### FR-23: Solo el dueño la desactiva
Solo el dueño de Cuadra puede desactivar la separación de funciones, empresa por empresa.
**Consecuencias:**
- El motivo es obligatorio.
- Queda en la bitácora quién, cuándo y por qué.

#### FR-24: Aviso de empresa sin separación
Cuando una empresa opera sin separación de funciones, la bitácora y la bandeja lo muestran de forma visible.

#### FR-25: Acceso de solo lectura para el cliente
El rol `auditor` ve la bandeja y la bitácora, y no puede confirmar, rechazar, reabrir ni descartar.

#### FR-68: Observación sobre una confirmación ajena
Quien revisa deja un comentario de texto libre sobre el caso, sin cambiar su estado.
**Consecuencias:**
- El comentario se ve en el detalle del caso y queda en la bitácora con persona y fecha.
- No reabre, rechaza ni edita nada; si la contadora está de acuerdo, reabre ella (FR-26).
- El auditor no comenta: es de solo lectura.

### 4.4 Reapertura (F4)

**Descripción:** una confirmación, o un lote completo, se puede deshacer con motivo. Realiza UJ-1.

#### FR-26: Quién reabre
El `admin` o quien hizo la confirmación puede reabrirla, con un motivo obligatorio.

#### FR-27: Efecto de reabrir
Al reabrir, el caso vuelve a la bandeja como pendiente, con la factura y el movimiento abiertos.
**Consecuencias:**
- La confirmación original queda en el historial.

#### FR-28: Reconfirmar
Volver a confirmar sigue las mismas reglas, incluida la separación de funciones.

#### FR-29: Registro de la reapertura
Cada reapertura queda en la bitácora con persona, fecha y motivo.

#### FR-30: Quién no reabre
El revisor y el auditor no pueden reabrir confirmaciones ajenas.

#### FR-31: Identificador de lote
Cada confirmación en lote queda ligada a un identificador de lote.

#### FR-32: Reabrir un lote
Reabrir un lote reabre todos sus casos que sigan confirmados, con un solo motivo.

#### FR-33: Casos ya reabiertos
Los casos del lote que ya se reabrieron o se reconfirmaron después se omiten, y el sistema informa cuántos fueron.

**Notas:** no hay límite de tiempo para reabrir en la v2. Cuando exista un cierre de periodo contable, la reapertura de un periodo cerrado exigirá rol de administrador y motivo, y el plazo se decidirá con lo que cuenten los contadores reales.

### 4.5 Modo sombra y muestreo (F5)

**Descripción:** Cuadra mide, sin cerrar nada, cuánto de lo que habría cerrado solo la persona confirma, y verifica la calidad de las confirmaciones en lote con un muestreo independiente. Es la evidencia para decidir la etapa 2. Realiza UJ-3 y el objetivo del dueño de Cuadra.

#### FR-34: Registrar lo que habría cerrado
Para cada propuesta de la regla 1, el sistema registra que la habría cerrado sola, sin cerrar nada.

#### FR-35: Registrar la respuesta de la persona
El sistema registra qué hizo la persona después: confirmó, rechazó, desmarcó o reabrió más tarde.
**Consecuencias:**
- Cuenta como **desacuerdo** cuando la persona rechaza la propuesta, la reabre más tarde, o la desmarca y acaba resolviéndola de otra forma.
- Si la desmarca y luego la confirma igual, no cuenta.

#### FR-36: Tasa de la empresa
El administrador de cada empresa ve la tasa de desacuerdo de su empresa *(fase 3)*.

#### FR-37: Tasa por banco y empresa
El dueño de Cuadra ve la tasa por banco y por empresa *(fase 3)*.

#### FR-38: Registro desde la fase 2a
El registro empieza en la fase 2a, aunque las pantallas lleguen en la fase 3.

#### FR-69: Medir parcialidades, comisiones y PPD
El modo sombra registra, por empresa, tres fracciones que dicen si alguno de esos casos entra en la v2.
**Consecuencias:**
- Facturas con método de pago PPD sobre el total de facturas.
- Movimientos que forman parte de una parcialidad sobre el total de movimientos.
- Cargos de comisión sobre el total de movimientos.
- No existe un porcentaje universal: depende de la operación de cada empresa, por eso se mide por empresa.
- El registro empieza en la fase 2a (como FR-38) y las pantallas llegan en la fase 3.

#### FR-63: Muestreo de verificación
Cada mes, para cada empresa, el sistema elige al azar propuestas de la regla 1 confirmadas en lote y pide verificarlas una por una.
**Consecuencias:**
- La muestra es del 5% de las confirmadas en lote, con un mínimo de 20 casos (o todas, si hay menos) **[SUPUESTO]**.
- La verifica el revisor; si la empresa no tiene revisor, el administrador **[SUPUESTO]**. Cuando existe otra persona, no la hace quien confirmó el lote **[SUPUESTO]**.
- Cada caso se marca conforme o en desacuerdo, con persona y fecha, y queda en la bitácora.
- La tasa de desacuerdo que decide la etapa 2 (SM-C1) se calcula sobre estas muestras, no solo sobre las respuestas de quien confirmó el lote.
- El auditor no verifica: es de solo lectura.

### 4.6 Empresas y usuarios (F6)

**Descripción:** el dueño de Cuadra da de alta cada empresa y su primer administrador; el administrador gestiona a sus usuarios. No hay registro abierto. Realiza UJ-2.

#### FR-39: Crear una empresa
El dueño de Cuadra crea una empresa con su nombre y el RFC que verificó, e invita por correo a su primer administrador.

#### FR-40: Invitación de un solo uso
La invitación es de un solo uso; el invitado fija su contraseña.
**Consecuencias:**
- La respuesta al invitar no revela si el correo ya tenía cuenta.

#### FR-41: Invitar usuarios
El administrador invita usuarios por correo y elige uno o más roles: `admin`, `contador`, `revisor` o `auditor`.

#### FR-42: Invitación pendiente
Una invitación pendiente se puede reenviar o cancelar.
**Consecuencias:**
- Reenviar invalida el enlace anterior.

#### FR-43: Caducidad
Todo enlace caduca: las invitaciones a los 7 días y la recuperación de contraseña a la hora **[SUPUESTO]**.

#### FR-44: Recuperar la contraseña
La contraseña olvidada se recupera por correo, con un enlace que caduca.
**Consecuencias:**
- La respuesta no revela si el correo existe.

#### FR-45: Quitar un rol
El administrador quita el rol de un usuario en su empresa.
**Consecuencias:**
- El usuario conserva sus roles en otras empresas.

#### FR-46: Último administrador
No se puede quitar ni degradar al último administrador de una empresa **[SUPUESTO]**.

#### FR-47: Lista de usuarios
Solo el administrador ve la lista de usuarios de su empresa.

#### FR-48: Cuenta única
Una persona que ya existe y recibe otra invitación usa la misma cuenta.

#### FR-49: RFC único
El RFC de una empresa es único entre las empresas.
**Consecuencias:**
- Como el dueño verifica el RFC antes de crear la empresa, en la v2 no existen reclamos sin verificar. Si algún día se abre el registro, un reclamo sin verificar no debe bloquear a su dueño legítimo.

#### FR-50: Bitácora de administración
Altas, bajas, cambios de rol e invitaciones quedan en la bitácora.

#### FR-67: Pantalla interna del dueño
El dueño de Cuadra opera desde una pantalla interna de la aplicación: crear empresas e invitar a su primer administrador (FR-39), levantar la vista previa por banco (FR-3), desactivar la separación de funciones por empresa (FR-23) y, en la etapa 2, activar el cierre automático.
**Consecuencias:**
- Solo la ve y la usa quien tiene el rol de plataforma `dueño`; ninguna empresa la ve.
- Cada acción queda en la bitácora con quién, cuándo y, cuando aplica, el motivo.
- Un intento sin permiso queda como acceso denegado (FR-55).

### 4.7 Bitácora y menú por rol (F7)

**Descripción:** la bitácora es el respaldo de confianza y cada rol solo ve lo que le corresponde. Realiza UJ-3.

#### FR-51: Quién ve la bitácora
La ven el `admin`, el `contador`, el `revisor` y el `auditor`; nadie puede modificarla ni borrarla desde la aplicación.

#### FR-52: Registro de las cargas
Cada carga queda en la bitácora con persona, fecha, archivo y resultado.

#### FR-53: Menú y acciones según el rol
El menú de cada rol muestra solo lo que puede usar, y las acciones siguen la matriz de abajo.

| Sección | admin | contador | revisor | auditor |
|---|---|---|---|---|
| Bandeja | sí | sí | sí | solo lectura |
| Cargas | sí | sí | no | no |
| Tolerancia | edita | solo lectura | no | no |
| Bitácora | sí | sí | sí | sí |
| Usuarios | sí | no | no | no |

| Acción | admin | contador | revisor | auditor | dueño |
|---|---|---|---|---|---|
| Cargar archivos | sí | sí | no | no | no |
| Confirmar y rechazar | sí | sí | sí | no | no |
| Descartar un movimiento | sí | sí | sí **[SUPUESTO]** | no | no |
| Deshacer un descarte **[SUPUESTO]** | sí | solo lo que descartó | solo lo que descartó | no | no |
| Comentar una confirmación ajena (FR-68) | sí **[SUPUESTO]** | sí **[SUPUESTO]** | sí | no | no |
| Reabrir | sí | solo lo que confirmó | solo lo que confirmó | no | no |
| Verificar la muestra (FR-63) | si no hay revisor | no | sí | no | no |
| Editar la tolerancia | sí | no | no | no | no |
| Invitar y quitar roles | sí | no | no | no | no |
| Crear empresas, levantar la vista previa y desactivar la separación | no | no | no | no | sí |

#### FR-54: El auditor solo consulta
El auditor no ve botones de acción.

#### FR-55: Accesos denegados
Un intento sin permiso queda en la bitácora como acceso denegado.

### 4.8 Base para producción (F8) **[SUPUESTO]**

**Descripción:** lo mínimo para que un cliente real use Cuadra con seguridad. No se decidió explícitamente su detalle; sin esto no hay uso real. Reemplaza dos decisiones de la v1 (sección 11).

#### FR-56: Despliegue repetible
El sistema se despliega de forma repetible, con migraciones controladas.
**Consecuencias:**
- Un entorno limpio queda funcionando con un procedimiento documentado y sin pasos manuales no escritos **[SUPUESTO]**.

#### FR-57: Origen autorizado
El navegador solo puede llamar a la API desde el origen autorizado (CORS).

#### FR-58: Límite de peticiones
Hay un límite de peticiones, sobre todo en inicio de sesión, recuperación de contraseña e invitaciones.
**Consecuencias:**
- Más de cinco intentos fallidos de inicio de sesión por minuto desde la misma dirección reciben un rechazo por exceso de peticiones **[SUPUESTO]**.

#### FR-59: Sesión persistente
La sesión no se pierde al recargar la página.
**Consecuencias:**
- Pide la contraseña tras 8 horas sin actividad y se renueva mientras la persona trabaja **[SUPUESTO]**.
- Hay un botón de cerrar sesión que invalida la sesión en el servidor.

#### FR-60: Secretos
Los secretos viven fuera del repositorio, y las credenciales por defecto no sirven en producción.

#### FR-61: Correo configurable
El correo para invitaciones y recuperación de contraseña es configurable. La v1 no tiene servicio de correo.

#### FR-62: Prueba real con la IA
La prueba real con el proveedor de IA se hace antes de activarlo en producción.

#### FR-70: Pruebas de extremo a extremo
Antes de la fase 2a hay al menos un recorrido de extremo a extremo por cada recorrido de usuario (UJ-1 a UJ-3), contra la API real y con Postgres real.
**Consecuencias:**
- Comprueban juntos el aislamiento por empresa (RLS y `company_id`) y los flujos completos, algo que las pruebas unitarias no garantizan.
- No es una suite exhaustiva: un recorrido por journey.
- Son parte de la puerta de salida de la fase 1.

## 5. Requisitos transversales

- **Aislamiento por empresa.** Ninguna consulta de dominio sale sin filtro de `company_id`; el aislamiento se impone en la base de datos, no solo en el código. Las tablas de empresas, usuarios y roles, que la v1 deja fuera del aislamiento, se tocan solo por una vía con permisos propios y con pruebas de que un usuario no puede listar ni unirse a empresas ajenas.
- **Dinero.** Los montos son exactos (`NUMERIC`), nunca de coma flotante, y un monto nunca se parte en dos líneas ni se sale de su contenedor.
- **Decisiones.** El motor de reglas decide y la IA solo sugiere; ninguna decisión se toma en el navegador.
- **Auditoría.** La bitácora es de solo agregar. Un error se corrige con una entrada nueva, no reescribiendo.
- **Privacidad.** Al proveedor de IA solo se envía una lista cerrada de campos del texto bancario.
- **Rendimiento.** Una carga de cientos de movimientos aparece procesada en segundos **[SUPUESTO]**.
- **Presentación.** Tema claro y oscuro con selector; textos en español.

## 6. No objetivos

- No cierra casos por sí misma en la v2: el cierre automático (etapa 2) llega solo si el modo sombra y el muestreo lo justifican.
- No resuelve parcialidades (varios pagos para una factura), pagos diferidos (PPD) con su complemento de pago, ni comisiones bancarias.
- No maneja otras monedas, ni PDF escaneados, ni cuentas personales: la v2 lee solo estados de cuenta de cuentas empresariales.
- No tiene registro abierto ni verificación del RFC con e.firma.
- No concilia cargos, egresos ni notas de crédito **[SUPUESTO]**.
- No valida el timbre del SAT de los CFDI ni consulta al SAT si un CFDI fue cancelado.

### Condiciones previstas de la etapa 2 (fuera del alcance de la v2)

Se registran para que la v2 no las cierre por accidente:
- Solo se cerrarán por Cuadra las propuestas de la regla 1 con candidata única, sin tolerancia ni ambigüedad. Los depósitos con varias facturas nunca se cierran solos.
- El cierre tendrá como actor al sistema, será reversible (solo el `admin` lo reabre) y generará una lista de "cerrados automáticamente" revisada por muestreo.
- Se activará empresa por empresa, y solo lo activa el dueño de Cuadra desde la pantalla interna (FR-67); queda en la bitácora quién y cuándo.
- Exige haber cumplido la condición SM-C1.
- Exige cambiar la restricción de la v1 que impide cerrar sin una persona (sección 11), y no antes.

## 7. Alcance y hoja de ruta

| Fase | Contenido | Puerta de salida |
|---|---|---|
| **1. Puerta de entrada segura** | F8, F6, F7 | Un cliente real puede entrar con seguridad, y UJ-1 a UJ-3 pasan de extremo a extremo contra la API real (FR-70) |
| **2a. Primer mes real con BBVA** | F1 (PDF de BBVA, CSV y CFDI), F2, F3, F4 y el registro del modo sombra (FR-34, FR-35, FR-38, FR-69) | Un mes real de una empresa real se concilia en ≤ 4 horas |
| **2b. Los tres bancos** | F1: lectores de Banorte y Santander | BBVA, Banorte y Santander funcionan con cuadre de saldos |
| **3. Medir** | F5: pantallas de tasa de desacuerdo (FR-36, FR-37) y muestreo de verificación (FR-63) | SM-2 ≥ 80% medida y tasa de desacuerdo conocida sobre la muestra verificada |

Razones del orden: sin F8 y F6 no entra un cliente real; confirmar un lote con un clic exige poder deshacer, por eso F4 va con F3; el modo sombra registra datos desde 2a para no perder semanas de medición; un banco primero lleva antes al primer mes real.

Prerrequisitos que no son de producto: estados de cuenta PDF reales y anonimizados de los tres bancos (antes de 2a) y dejar funcionando la memoria Engram antes de la primera historia. Con esos PDF también se confirma que los tres bancos traen saldo inicial y final (pregunta abierta 1).

## 8. Métricas de éxito

**Primarias**
- **SM-1:** tiempo para conciliar un mes de una empresa (cientos de movimientos): **≤ 4 horas por empresa-mes**. Valida FR-1 a FR-21 y FR-26 a FR-33.
- **SM-2:** abonos del mes con propuesta correcta, de cualquier regla: **≥ 80%**. Numerador: propuestas confirmadas y no reabiertas durante el mes. Denominador: abonos del mes, sin contar los descartados **[SUPUESTO]**. Se mide con los registros ordinarios de confirmación y reapertura, no con el modo sombra. Valida FR-10 a FR-21.

**Contra-métricas (no optimizar a costa de ellas)**
- **SM-C1:** tasa de desacuerdo de la regla 1. Es la condición para considerar la etapa 2: **≤ 0.5% sobre al menos 1,000 propuestas de la regla 1 en al menos 3 empresas distintas, durante al menos 3 meses [SUPUESTO]**. Se calcula sobre la muestra verificada (FR-63) además de las respuestas registradas (FR-35), para que confirmar el lote sin mirar no la reduzca artificialmente. Contrapesa a SM-1 y SM-2: no se persigue velocidad ni cobertura si sube esta tasa. Valida FR-34 a FR-38 y FR-63.
- **SM-C2:** cierres incorrectos descubiertos después del cierre del mes (reaperturas con motivo de error y desacuerdos del muestreo): **cero**. Lo que nadie descubre no se puede medir; por eso existe el muestreo. Valida FR-17 a FR-33, FR-51 a FR-55 y FR-63.

## 9. Preguntas abiertas

1. ¿Los PDF de BBVA, Banorte y Santander traen saldo inicial y final? Hipótesis de la investigación: sí, los tres. Se confirma con los PDF reales anonimizados antes de la fase 2a; si algún banco no los trae, su lector queda sin cuadre automático y lo revisa una persona.

### 9.1 Resueltas

| Pregunta | Decisión | Dónde quedó |
|---|---|---|
| Cómo opera el dueño de Cuadra | Pantalla interna, con rol de plataforma | FR-67, sección 11 |
| Diseño del PDF por tipo de cuenta | Cambia; la v2 lee solo cuentas empresariales | FR-1, sección 6 |
| Suma de un depósito con varias facturas | Admite la tolerancia de la empresa | FR-11 |
| Motivo en la confirmación en lote | No; basta con la regla que la originó | FR-19 |
| Observación del revisor | Comentario de texto libre sobre el caso | FR-68 |
| Detalle del descarte | Lleva motivo y se puede deshacer | FR-21 |
| Fracción de parcialidades, comisiones y PPD | Se mide por empresa en el modo sombra | FR-69 |
| Quién activa el cierre automático | Solo el dueño de Cuadra, desde la pantalla interna | Sección 6, FR-67 |
| Límite de tiempo para reabrir | Ninguno en la v2; se decide con el cierre de periodo | FR-33 (notas) |
| CFDI cancelado | Sin consulta al SAT; sale de las propuestas y el caso conciliado va a revisión humana | FR-66, sección 6 |
| Duplicados entre archivos | Huella del movimiento y resumen de confirmación | FR-65 |
| Pruebas de extremo a extremo | Sí, como puerta de salida de la fase 1 | FR-70, sección 7 |

## 10. Índice de supuestos

- FR-1: tamaño máximo de 10 MB, igual que la v1; un estado de cuenta que no está en MXN se rechaza.
- FR-3: cinco cargos revisados por banco antes de levantar la vista previa.
- FR-21: deshacer un descarte lo hace quien lo descartó o el `admin`.
- FR-43: invitaciones de 7 días y recuperación de contraseña de 1 hora.
- FR-46: el último administrador no se puede quitar.
- FR-53: el revisor puede descartar un movimiento; el `admin` y el `contador` también pueden comentar (FR-68).
- FR-56: un entorno limpio se levanta con un procedimiento documentado.
- FR-58: más de cinco intentos fallidos de inicio de sesión por minuto reciben rechazo.
- FR-59: sesión de 8 horas sin actividad.
- FR-63: muestra del 5%, mínimo 20 casos; verifica el revisor (o el administrador); otra persona distinta de quien confirmó el lote.
- Sección 3: el nivel de confianza coincide con la puntuación de la regla; un usuario puede tener uno o más roles y roles distintos en distintas empresas.
- Sección 4.8: la base para producción completa (F8).
- Sección 5: carga de cientos de movimientos procesada en segundos.
- Sección 6: cargos, egresos y notas de crédito quedan fuera.
- Pregunta abierta 1: los tres bancos traen saldo inicial y final (hipótesis sin verificar).
- SM-2: los abonos descartados no cuentan en el denominador.
- SM-C1: ≤ 0.5% de desacuerdo sobre 1,000 propuestas, en 3 empresas y durante 3 meses.

## 11. Implicaciones para el modelo de la v1 (para arquitectura)

Este PRD decide distinto de la v1 en los puntos siguientes. No prescriben el diseño, solo lo que arquitectura debe resolver:

- **Varias confirmaciones por movimiento (FR-11).** La v1 permite una sola conciliación confirmada por movimiento (índice único parcial); la v2 debe permitir varias, conservando una sola por CFDI, y calcular la diferencia del grupo.
- **Reapertura (F4).** La confirmación original debe quedar en el historial, y la restricción de unicidad del par de la v1 no debe impedir una nueva fila al reconfirmar. Cada confirmación en lote guarda su identificador de lote.
- **Bitácora.** La v1 admite siete acciones; la v2 necesita al menos reabrir, descartar, invitar, cambiar o quitar un rol, desactivar la separación de funciones, levantar la vista previa, verificar la muestra, deshacer un descarte y comentar una confirmación.
- **Roles.** La v1 tiene `admin`, `contador` y `revisor`; el `auditor` estaba previsto "después" y la v2 lo trae. El dueño de Cuadra es un rol de plataforma que la v1 no tiene; opera desde una pantalla interna (FR-67), separada de las de empresa. Una persona puede tener varios roles en una misma empresa (D-08).
- **Separación de funciones.** En la v1 es una regla fija (CU-15); en la v2 es configurable por empresa, activa por defecto y falla cerrada.
- **Cierre del sistema (etapa 2).** La restricción `ck_conciliaciones_confirmada_requiere_persona` impide hoy cerrar sin persona; se cambia en la etapa 2, no antes.
- **Estados de cuenta en PDF.** Hacen falta saldo inicial y final, un estado "pendiente de vista previa" y el conteo de cargas revisadas por banco. En la v1 un banco es configuración en JSON; un lector de PDF es código.
- **Moneda.** La columna de moneda del movimiento tiene hoy el valor MXN por defecto y nunca se asigna al importar; la v2 la valida (FR-1).
- **Duplicados entre archivos (FR-65).** Hace falta una huella del movimiento y un resumen de importación que la persona confirma; la idempotencia de la v1 (FR-6) solo cubre el mismo archivo.
- **CFDI cancelado (FR-66).** La v1 define el estado `cancelada` pero nunca lo asigna; la v2 lo asigna desde el XML o un dato cargado y marca para revisión los casos ya conciliados.
- **Descarte (FR-21).** Debe guardar el motivo y poder deshacerse.
- **Tablas de empresas, usuarios y roles.** La v1 las deja fuera del aislamiento por empresa; ver requisitos transversales.
- **Decisiones de la v1 que este PRD reemplaza.** D-09 (sesión de 15 minutos, sin refresco ni cierre de sesión en el servidor) y D-11 (límite de peticiones y bloqueo de cuenta delegados a un proxy). También cambia que la v1 no tenga servicio de correo.
- **Documentos a corregir.** El diagrama principal de `CUADRA.md` sugiere una rama "conciliado por evidencia fuerte" que el modelo de datos de la v1 hace imposible; hay que alinearlo con este PRD.
- **Pruebas.** El rol `auditor` afecta las pruebas de deriva entre backend y frontend de la v1. Los recorridos UJ-1 a UJ-3 necesitan pruebas de extremo a extremo contra la API real (FR-70).
