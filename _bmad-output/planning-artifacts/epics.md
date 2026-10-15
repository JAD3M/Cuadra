---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-cuadra-2026-10-08/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-cuadra-2026-10-08/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/analisis-v1.md
  - _bmad-output/planning-artifacts/briefs/brief-cuadra-2026-10-08/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-cuadra-2026-10-08/addendum.md
  - CUADRA.md
---

# Cuadra v2 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Cuadra v2, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: Cargar un estado de cuenta en PDF del portal. El contador o el administrador sube el PDF descargado del portal del banco y elige el banco a mano. BBVA es el primero.
FR-2: Cuadre de saldos. Si saldo inicial + abonos − cargos no es igual al saldo final, la carga se rechaza completa.
FR-3: Vista previa obligatoria por banco. Hasta que el dueño de Cuadra la levante para ese banco, cada carga en PDF muestra primero lo que el sistema leyó, y no se concilia hasta que una persona lo acepta.
FR-4: Cargar un estado de cuenta en CSV. Se conserva el comportamiento de la v1 (CU-09).
FR-5: Cargar CFDI. El contador o el administrador sube los CFDI del mes en XML.
FR-6: Idempotencia. Subir dos veces el mismo archivo en la misma empresa no duplica nada.
FR-7: Rechazar un PDF escaneado. Un PDF sin texto o escaneado se rechaza.
FR-8: Historial de cargas. La persona ve la lista de cargas de la empresa con su estado.
FR-9: Quién carga. Solo el `admin` y el `contador` cargan archivos; el revisor y el auditor no ven Cargas.
FR-10: Proponer un par de una factura y un movimiento. Cuadra propone un movimiento con una factura y muestra la regla que lo originó.
FR-11: Proponer un depósito con varias facturas. Cuadra propone un movimiento con varias facturas solo cuando el subconjunto es único.
FR-12: No proponer ante varias combinaciones. Si varias combinaciones de facturas suman el mismo monto, Cuadra no propone.
FR-13: Solo MXN. Un CFDI en otra moneda no se empata.
FR-14: Un par rechazado no vuelve. Un par rechazado no se vuelve a proponer.
FR-15: Cuadra no cierra casos. El motor y la IA solo producen propuestas; únicamente una persona confirma.
FR-16: Nivel de confianza. Cada propuesta lleva un nivel de confianza, y la bandeja se ordena por él (definición en el Glosario).
FR-17: Bandeja ordenada por confianza. La bandeja se ordena por confianza y muestra factura, movimiento, diferencia y motivo.
FR-18: Lote con la regla 1 marcada. En el lote solo las propuestas de la regla 1 vienen marcadas.
FR-19: Confirmar en lote. La persona desmarca lo que no le convence y confirma el lote.
FR-20: Confirmar o rechazar un caso individual. La persona confirma o rechaza un caso, con candidatos y explicación.
FR-21: Descartar un movimiento. La persona descarta un movimiento que no es de ningún cliente (comisiones, intereses).
FR-22: Separación de funciones activa por defecto. Quien subió una carga no puede confirmar sus conciliaciones.
FR-23: Solo el dueño la desactiva. Solo el dueño de Cuadra puede desactivar la separación de funciones, empresa por empresa.
FR-24: Aviso de empresa sin separación. Cuando una empresa opera sin separación de funciones, la bitácora y la bandeja lo muestran de forma visible.
FR-25: Acceso de solo lectura para el cliente. El rol `auditor` ve la bandeja y la bitácora, y no puede confirmar, rechazar, reabrir ni descartar.
FR-26: Quién reabre. El `admin` o quien hizo la confirmación puede reabrirla, con un motivo obligatorio.
FR-27: Efecto de reabrir. Al reabrir, el caso vuelve a la bandeja como pendiente, con la factura y el movimiento abiertos.
FR-28: Reconfirmar. Volver a confirmar sigue las mismas reglas, incluida la separación de funciones.
FR-29: Registro de la reapertura. Cada reapertura queda en la bitácora con persona, fecha y motivo.
FR-30: Quién no reabre. El revisor y el auditor no pueden reabrir confirmaciones ajenas.
FR-31: Identificador de lote. Cada confirmación en lote queda ligada a un identificador de lote.
FR-32: Reabrir un lote. Reabrir un lote reabre todos sus casos que sigan confirmados, con un solo motivo.
FR-33: Casos ya reabiertos. Los casos del lote que ya se reabrieron o se reconfirmaron después se omiten, y el sistema informa cuántos fueron.
FR-34: Registrar lo que habría cerrado. Para cada propuesta de la regla 1, el sistema registra que la habría cerrado sola, sin cerrar nada.
FR-35: Registrar la respuesta de la persona. El sistema registra qué hizo la persona después: confirmó, rechazó, desmarcó o reabrió más tarde.
FR-36: Tasa de la empresa. El administrador de cada empresa ve la tasa de desacuerdo de su empresa *(fase 3)*.
FR-37: Tasa por banco y empresa. El dueño de Cuadra ve la tasa por banco y por empresa *(fase 3)*.
FR-38: Registro desde la fase 2a. El registro empieza en la fase 2a, aunque las pantallas lleguen en la fase 3.
FR-39: Crear una empresa. El dueño de Cuadra crea una empresa con su nombre y el RFC que verificó, e invita por correo a su primer administrador.
FR-40: Invitación de un solo uso. La invitación es de un solo uso; el invitado fija su contraseña.
FR-41: Invitar usuarios. El administrador invita usuarios por correo y elige uno o más roles: `admin`, `contador`, `revisor` o `auditor`.
FR-42: Invitación pendiente. Una invitación pendiente se puede reenviar o cancelar.
FR-43: Caducidad. Todo enlace caduca: las invitaciones a los 7 días y la recuperación de contraseña a la hora **[SUPUESTO]**.
FR-44: Recuperar la contraseña. La contraseña olvidada se recupera por correo, con un enlace que caduca.
FR-45: Quitar un rol. El administrador quita el rol de un usuario en su empresa.
FR-46: Último administrador. No se puede quitar ni degradar al último administrador de una empresa **[SUPUESTO]**.
FR-47: Lista de usuarios. Solo el administrador ve la lista de usuarios de su empresa.
FR-48: Cuenta única. Una persona que ya existe y recibe otra invitación usa la misma cuenta.
FR-49: RFC único. El RFC de una empresa es único entre las empresas.
FR-50: Bitácora de administración. Altas, bajas, cambios de rol e invitaciones quedan en la bitácora.
FR-51: Quién ve la bitácora. La ven el `admin`, el `contador`, el `revisor` y el `auditor`; nadie puede modificarla ni borrarla desde la aplicación.
FR-52: Registro de las cargas. Cada carga queda en la bitácora con persona, fecha, archivo y resultado.
FR-53: Menú y acciones según el rol. El menú de cada rol muestra solo lo que puede usar, y las acciones siguen la matriz de abajo.
FR-54: El auditor solo consulta. El auditor no ve botones de acción.
FR-55: Accesos denegados. Un intento sin permiso queda en la bitácora como acceso denegado.
FR-56: Despliegue repetible. El sistema se despliega de forma repetible, con migraciones controladas.
FR-57: Origen autorizado. El navegador solo puede llamar a la API desde el origen autorizado (CORS).
FR-58: Límite de peticiones. Hay un límite de peticiones, sobre todo en inicio de sesión, recuperación de contraseña e invitaciones.
FR-59: Sesión persistente. La sesión no se pierde al recargar la página.
FR-60: Secretos. Los secretos viven fuera del repositorio, y las credenciales por defecto no sirven en producción.
FR-61: Correo configurable. El correo para invitaciones y recuperación de contraseña es configurable. La v1 no tiene servicio de correo.
FR-62: Prueba real con la IA. La prueba real con el proveedor de IA se hace antes de activarlo en producción.
FR-63: Muestreo de verificación. Cada mes, para cada empresa, el sistema elige al azar propuestas de la regla 1 confirmadas en lote y pide verificarlas una por una.
FR-64: Sugerencias de la IA. En los casos ambiguos la IA puede sugerir candidatos y explicar por qué el caso es ambiguo.
FR-65: Duplicados entre archivos. Cuando dos archivos distintos cubren el mismo periodo (un PDF y un CSV del mismo mes, o periodos que se traslapan), Cuadra detecta los movimientos repetidos por su huella y la persona confirma antes de importar.
FR-66: CFDI cancelado. Si el XML o un dato cargado indica que un CFDI está cancelado, la factura pasa al estado `cancelada`.
FR-67: Pantalla interna del dueño. El dueño de Cuadra opera desde una pantalla interna de la aplicación: crear empresas e invitar a su primer administrador (FR-39), levantar la vista previa por banco (FR-3), desactivar la separación de funciones por empresa (FR-23) y, en la etapa 2, activar el cierre automático.
FR-68: Observación sobre una confirmación ajena. Quien revisa deja un comentario de texto libre sobre el caso, sin cambiar su estado.
FR-69: Medir parcialidades, comisiones y PPD. El modo sombra registra, por empresa, tres fracciones que dicen si alguno de esos casos entra en la v2.
FR-70: Pruebas de extremo a extremo. Antes de la fase 2a hay al menos un recorrido de extremo a extremo por cada recorrido de usuario (UJ-1 a UJ-3), contra la API real y con Postgres real.

### NonFunctional Requirements

NFR1: Aislamiento por empresa. Ninguna consulta de dominio sale sin filtro de `company_id` y el aislamiento se impone en la base de datos (RLS con FORCE), no solo en el código.
NFR2: Dinero exacto. Los montos son `NUMERIC`, nunca de coma flotante, en backend y frontend.
NFR3: Decisiones. El motor de reglas decide y la IA solo sugiere; ninguna decisión se toma en el navegador.
NFR4: Auditoría. La bitácora es de solo agregar; un error se corrige con una entrada nueva.
NFR5: Privacidad. Al proveedor de IA solo se envía una lista cerrada de campos del texto bancario.
NFR6: Rendimiento. Una carga de cientos de movimientos aparece procesada en segundos.
NFR7: Presentación. Tema claro y oscuro con selector; textos en español.
NFR8: Un falso positivo es peor que no conciliar.
NFR9 (SM-1): conciliar un mes de una empresa (cientos de movimientos) en <= 4 horas por empresa-mes.
NFR10 (SM-2): >= 80% de los abonos del mes con propuesta correcta (confirmada y no reabierta).
NFR11 (SM-C1): tasa de desacuerdo de la regla 1 <= 0.5% sobre >= 1,000 propuestas, en >= 3 empresas y >= 3 meses; condición para considerar la etapa 2.
NFR12 (SM-C2): cierres incorrectos descubiertos después del cierre del mes: cero.

### Additional Requirements

- AD-1: Paradigma y capas [ADOPTED] (ver ARCHITECTURE-SPINE.md)
- AD-2: Tres clases de tabla, cada una con su acceso [ADOPTED en la clase 1] (ver ARCHITECTURE-SPINE.md)
- AD-3: Nada cierra un caso sin una persona [ADOPTED] (ver ARCHITECTURE-SPINE.md)
- AD-4: Una confirmación es una decisión con sus líneas y un ciclo de vida cerrado (ver ARCHITECTURE-SPINE.md)
- AD-5: Dos mundos: empresa y plataforma (ver ARCHITECTURE-SPINE.md)
- AD-6: Sesión opaca en la base de datos (ver ARCHITECTURE-SPINE.md)
- AD-7: Bitácora de solo agregar, en la misma transacción (ver ARCHITECTURE-SPINE.md)
- AD-8: Lectores de PDF como funciones puras con un cuadre común (ver ARCHITECTURE-SPINE.md)
- AD-9: Duplicados por huella, sin descartar nada solo (ver ARCHITECTURE-SPINE.md)
- AD-10: Modo sombra y muestreo como evidencia que no se puede reescribir (ver ARCHITECTURE-SPINE.md)
- AD-11: Una sola matriz de permisos, evaluada en el servidor y expuesta al frontend (ver ARCHITECTURE-SPINE.md)
- AD-12: Dominio compartido con prueba de deriva [ADOPTED] (ver ARCHITECTURE-SPINE.md)
- AD-13: Separación de funciones configurable y que falla cerrada (ver ARCHITECTURE-SPINE.md)
- AD-14: Correo e invitaciones detrás de un puerto (ver ARCHITECTURE-SPINE.md)
- AD-15: Límite de peticiones dentro de la aplicación (ver ARCHITECTURE-SPINE.md)
- AD-16: Cargas asíncronas con un payload mínimo [ADOPTED] (ver ARCHITECTURE-SPINE.md)
- AD-17: Despliegue: Docker Compose, host diferido (ver ARCHITECTURE-SPINE.md)
- AD-18: Las pruebas de extremo a extremo son por HTTP y obligatorias (ver ARCHITECTURE-SPINE.md)
- AD-19: Un candado por empresa y un orden fijo de bloqueos [ADOPTED en parte] (ver ARCHITECTURE-SPINE.md)
- AD-20: Migración de `conciliaciones` a `decisiones` en pasos que no rompen la v1 (ver ARCHITECTURE-SPINE.md)
- AD-21: La IA solo recibe una lista cerrada de campos [ADOPTED] (ver ARCHITECTURE-SPINE.md)
- Proyecto de estadía sin clientes reales: la arquitectura es demo-first, con Docker Compose y host diferido (AD-17).
- Pruebas: se usarán PDFs de ejemplo públicos y datos sintéticos; el flujo de alta de empresa se construye como si el cliente fuera real.
- Migración v1 a v2 en pasos que conservan los ids de `conciliaciones` (AD-20).
- Trampas de la v1 que toda historia de base de datos respeta: registrar tabla en `entidades.ts`, `rls.spec.ts` y `esquema.spec.ts`; todo valor nuevo en `tipos.ts` exige espejo en frontend, `CHECK` en migración y cuenta en la prueba de deriva.
- Preguntas abiertas pendientes: los tres bancos traen saldo inicial y final (hipótesis, se confirma con PDFs reales); la puerta de la fase 1 del PRD sin clientes reales.

### UX Design Requirements

UX-DR1: Cada pantalla parte de su mockup aprobado en Claude Design. Si una pantalla necesita algo que el mockup no tiene, el mockup se actualiza y se acuerda antes de escribir código.
UX-DR2: Tema claro y oscuro con un control para cambiar; el oscuro es el de los mockups y el claro usa los mismos roles de color.
UX-DR3: Un monto nunca se parte en dos líneas ni se sale de su contenedor; la caja crece con el número. Los montos no pasan por flotante en el frontend.
UX-DR4: Estados, reglas, roles y acciones salen del backend (`tipos.ts`); el frontend no inventa valores ni usa literales de rol.
UX-DR5: El menú y los botones salen de la lista de capacidades que entrega el servidor (FR-53, FR-54); el auditor no ve botones de acción.
UX-DR6: La bandeja se ordena por confianza y muestra factura, movimiento, diferencia y motivo; en el lote solo la regla 1 viene marcada.
UX-DR7: La vista previa de un PDF muestra lo leído, el número de movimientos y el resumen "N nuevos, M ya existentes" antes de conciliar.
UX-DR8: Una carga rechazada muestra el motivo y las líneas que no se pudieron leer; un CFDI en otra moneda muestra "moneda no soportada".
UX-DR9: Pantallas sin mockup hoy, que requieren mockup nuevo antes del código: pantalla interna del dueño, administración de usuarios e invitaciones, muestreo de verificación, comentarios del revisor, deshacer descarte y tasa de desacuerdo.

### FR Coverage Map

FR-1: Epic 3 - Cargar un estado de cuenta en PDF del portal
FR-2: Epic 3 - Cuadre de saldos
FR-3: Epic 3 - Vista previa obligatoria por banco
FR-4: Epic 3 - Cargar un estado de cuenta en CSV
FR-5: Epic 3 - Cargar CFDI
FR-6: Epic 3 - Idempotencia
FR-7: Epic 3 - Rechazar un PDF escaneado
FR-8: Epic 3 - Historial de cargas
FR-9: Epic 3 - Quién carga
FR-10: Epic 4 - Proponer un par de una factura y un movimiento
FR-11: Epic 4 - Proponer un depósito con varias facturas
FR-12: Epic 4 - No proponer ante varias combinaciones
FR-13: Epic 4 - Solo MXN
FR-14: Epic 4 - Un par rechazado no vuelve
FR-15: Epic 4 - Cuadra no cierra casos
FR-16: Epic 4 - Nivel de confianza
FR-17: Epic 5 - Bandeja ordenada por confianza
FR-18: Epic 5 - Lote con la regla 1 marcada
FR-19: Epic 5 - Confirmar en lote
FR-20: Epic 5 - Confirmar o rechazar un caso individual
FR-21: Epic 5 - Descartar un movimiento
FR-22: Epic 5 - Separación de funciones activa por defecto
FR-23: Epic 5 - Solo el dueño la desactiva
FR-24: Epic 5 - Aviso de empresa sin separación
FR-25: Epic 2 - Acceso de solo lectura para el cliente
FR-26: Epic 5 - Quién reabre
FR-27: Epic 5 - Efecto de reabrir
FR-28: Epic 5 - Reconfirmar
FR-29: Epic 5 - Registro de la reapertura
FR-30: Epic 5 - Quién no reabre
FR-31: Epic 5 - Identificador de lote
FR-32: Epic 5 - Reabrir un lote
FR-33: Epic 5 - Casos ya reabiertos
FR-34: Epic 6 - Registrar lo que habría cerrado
FR-35: Epic 6 - Registrar la respuesta de la persona
FR-36: Epic 9 - Tasa de la empresa
FR-37: Epic 9 - Tasa por banco y empresa
FR-38: Epic 6 - Registro desde la fase 2a
FR-39: Epic 1 - Crear una empresa
FR-40: Epic 1 - Invitación de un solo uso
FR-41: Epic 2 - Invitar usuarios
FR-42: Epic 2 - Invitación pendiente
FR-43: Epic 1 - Caducidad
FR-44: Epic 1 - Recuperar la contraseña
FR-45: Epic 2 - Quitar un rol
FR-46: Epic 2 - Último administrador
FR-47: Epic 2 - Lista de usuarios
FR-48: Epic 1 - Cuenta única
FR-49: Epic 1 - RFC único
FR-50: Epic 2 - Bitácora de administración
FR-51: Epic 2 - Quién ve la bitácora
FR-52: Epic 3 - Registro de las cargas
FR-53: Epic 2 - Menú y acciones según el rol
FR-54: Epic 2 - El auditor solo consulta
FR-55: Epic 2 - Accesos denegados
FR-56: Epic 1 - Despliegue repetible
FR-57: Epic 1 - Origen autorizado
FR-58: Epic 1 - Límite de peticiones
FR-59: Epic 1 - Sesión persistente
FR-60: Epic 1 - Secretos
FR-61: Epic 1 - Correo configurable
FR-62: Epic 7 - Prueba real con la IA
FR-63: Epic 9 - Muestreo de verificación
FR-64: Epic 4 - Sugerencias de la IA
FR-65: Epic 3 - Duplicados entre archivos
FR-66: Epic 4 - CFDI cancelado
FR-67: Epic 1 - Pantalla interna del dueño
FR-68: Epic 5 - Observación sobre una confirmación ajena
FR-69: Epic 6 - Medir parcialidades, comisiones y PPD
FR-70: Epic 7 - Pruebas de extremo a extremo

## Epic List

### Epic 1: Acceso seguro y alta de empresas
El dueño de Cuadra da de alta empresas y a su primer administrador desde una pantalla interna, y cualquier persona entra con una sesión que se puede cancelar, con límites de peticiones, correo configurable y un despliegue repetible.
**FRs covered:** FR-39, FR-40, FR-43, FR-44, FR-48, FR-49, FR-56, FR-57, FR-58, FR-59, FR-60, FR-61, FR-67

### Epic 2: Equipo y permisos por rol
El administrador invita a su gente, les da roles y los quita; cada rol ve y hace solo lo que le corresponde, y la bitácora muestra quién hizo qué.
**FRs covered:** FR-25, FR-41, FR-42, FR-45, FR-46, FR-47, FR-50, FR-51, FR-53, FR-54, FR-55

### Epic 3: Cargar el estado de cuenta y las facturas
El contador sube el PDF de BBVA, el CSV y los CFDI de una empresa; el sistema cuadra los saldos, muestra una vista previa, evita duplicados y deja el historial de cargas.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-52, FR-65

### Epic 4: Propuestas del motor
El motor propone parejas de factura y pago, incluidos los depósitos con varias facturas, sin cerrar nada; la confirmación pasa a ser una decisión con sus líneas sin perder los datos de la v1.
**FRs covered:** FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-64, FR-66

### Epic 5: Revisar, confirmar y deshacer
La persona revisa la bandeja ordenada por confianza, confirma en lote o caso por caso, descarta, comenta y reabre con motivo, con la separación de funciones activa por defecto.
**FRs covered:** FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-68

### Epic 6: Registro del modo sombra
Cuadra anota, sin cerrar nada, lo que habría cerrado sola y qué hizo la persona, y mide por empresa cuántos movimientos son PPD, parcialidades o comisiones.
**FRs covered:** FR-34, FR-35, FR-38, FR-69

### Epic 7: Demostrar de punta a punta
Los tres recorridos de usuario se prueban con la API, Postgres y Redis reales, con PDFs y datos de prueba, y hay una lista de verificación para cada demo.
**FRs covered:** FR-62, FR-70

### Epic 8: Banorte y Santander
El contador carga también los PDF de Banorte y Santander, cada uno con su lector y su cuadre de saldos. Extiende FR-1, FR-2 y FR-7.
**FRs covered:** ninguno propio; extiende FR-1, FR-2 y FR-7

### Epic 9: Medir y verificar
El dueño y el administrador ven la tasa de desacuerdo y el revisor verifica cada mes una muestra al azar de las confirmaciones en lote.
**FRs covered:** FR-36, FR-37, FR-63

## Epic 1: Acceso seguro y alta de empresas

El dueño de Cuadra da de alta empresas y a su primer administrador desde una pantalla interna, y cualquier persona entra con una sesión que se puede cancelar, con límites de peticiones, correo configurable y un despliegue repetible.

### Story 1.1: Iniciar y cerrar sesión con una sesión que el servidor puede cancelar

As a persona de una empresa,
I want iniciar sesión y que no se pierda al recargar la página,
So that pueda trabajar todo el día y, al cerrar sesión, nadie más pueda usar mi acceso.

**Acceptance Criteria:**

**Given** una persona con credenciales válidas
**When** inicia sesión
**Then** se crea una fila en `sesiones` (hash del token, tipo `empresa`, `company_id` nulo, `ultima_actividad`, `expira_en`) y el navegador recibe una cookie `httpOnly`, `Secure` y `SameSite=Lax`
**And** ningún token es legible desde JavaScript ni se guarda en el almacenamiento del navegador

**Given** una sesión sin empresa elegida
**When** la persona elige una empresa de las suyas
**Then** se actualiza el `company_id` de la misma fila y el token rota
**And** elegir una empresa en la que no tiene rol responde 403 y no cambia la sesión

**Given** una sesión activa
**When** la persona recarga la página
**Then** sigue dentro sin que se le pida la contraseña

**Given** 8 horas sin actividad
**When** la persona hace una petición
**Then** recibe 401 y vuelve a la pantalla de inicio de sesión
**And** una petición hecha antes de las 8 horas renueva el vencimiento

**Given** una sesión activa
**When** la persona cierra sesión
**Then** la fila se borra y el mismo token responde 401 de inmediato

**Given** la migración de esta historia
**When** se revisan los permisos de `cuadra_app`
**Then** tiene `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre `sesiones` (clase 2, AD-2) y ninguna otra tabla gana `DELETE`
**And** el JWT de la v1 y su decisión D-09 quedan retirados, y la prueba de deriva y las pruebas de la v1 siguen en verde

*Cubre: FR-59. Arquitectura: AD-2, AD-6. La pantalla de inicio de sesión ya existe en la v1 y no cambia (UX-DR1).*

### Story 1.2: Proteger el inicio de sesión con límite de peticiones y origen autorizado

As a dueño de Cuadra,
I want que el inicio de sesión resista intentos repetidos y solo acepte peticiones del origen autorizado,
So that nadie pueda adivinar contraseñas a fuerza bruta ni usar la API desde otro sitio.

**Acceptance Criteria:**

**Given** más de cinco intentos fallidos de inicio de sesión en un minuto desde la misma dirección
**When** llega el siguiente intento
**Then** responde 429 con un mensaje claro y el contador vive en Redis
**And** el rechazo queda en los registros sin revelar si el correo existe

**Given** el mecanismo de límite de peticiones
**When** otra historia lo necesite (invitaciones, recuperación de contraseña)
**Then** puede aplicarse a cualquier ruta declarando su límite, sin código nuevo de contadores

**Given** la API detrás de un proxy
**When** `trust proxy` está activado por variable de entorno
**Then** el límite usa la dirección real del cliente
**And** sin esa variable usa la dirección directa de la conexión

**Given** una variable con el origen autorizado
**When** llega una petición desde otro origen
**Then** se rechaza, y la API nunca responde con un origen abierto (`*`)

**Given** una petición que cambia datos y se autentica con la cookie de sesión
**When** su cabecera `Origin` no coincide con el origen autorizado
**Then** se rechaza con 403 y no cambia nada (defensa contra peticiones forzadas desde otro sitio)

**Given** la decisión D-11 de la v1 (límite delegado a un proxy)
**When** termina esta historia
**Then** queda reemplazada por el límite dentro de la aplicación, con una prueba que dispara el límite y otra que muestra que un intento correcto no lo consume de más

*Cubre: FR-57, FR-58. Arquitectura: AD-15; agrega el proveedor de cliente Redis que hoy no existe.*

### Story 1.3: Entrar a la pantalla interna del dueño de Cuadra

As a dueño de Cuadra,
I want entrar a una pantalla interna propia, separada de las de las empresas,
So that pueda operar la plataforma sin tener una empresa elegida ni mezclarme con los datos de ninguna.

**Acceptance Criteria:**

**Given** que `plataforma_usuarios` está vacía y no existe registro abierto
**When** se ejecuta el comando de siembra con un correo y una contraseña
**Then** se crea la cuenta del dueño con la contraseña guardada con hash
**And** no existe ninguna otra vía para crear dueños

**Given** las credenciales del dueño
**When** inicia sesión en la pantalla interna
**Then** se crea una sesión de tipo `plataforma`, sin `company_id`, y ve la pantalla interna con su lista de empresas (vacía al inicio)

**Given** una sesión de tipo `empresa`
**When** llama a cualquier ruta bajo `/plataforma`
**Then** responde 403 y queda un acceso denegado en la bitácora
**And** una sesión de tipo `plataforma` que llama a una ruta de empresa también responde 403

**Given** una petición con sesión `plataforma`
**When** pasa por el interceptor de transacción
**Then** nunca se abre una transacción de empresa sin `company_id`

**Given** una acción del dueño
**When** se completa
**Then** queda en `bitacora_plataforma`, que solo permite `SELECT` e `INSERT` a `cuadra_app`

**Given** las tablas de plataforma (clase 3)
**When** corre la prueba de arquitectura
**Then** falla si algún módulo fuera de `plataforma/` las nombra

**Given** que la pantalla interna no tiene mockup
**When** se planea el código
**Then** el mockup se crea y se acuerda antes de escribir la interfaz (UX-DR1, UX-DR9)

*Cubre: FR-67 (parte; levantar la vista previa llega en la épica 3 y apagar la separación de funciones en la 5). Arquitectura: AD-2, AD-5.*

### Story 1.4: Crear una empresa con su RFC verificado

As a dueño de Cuadra,
I want crear una empresa con su nombre y el RFC que ya verifiqué,
So that un cliente tenga su espacio aislado antes de que entre nadie.

**Acceptance Criteria:**

**Given** una sesión de plataforma
**When** el dueño crea una empresa con nombre y un RFC con formato válido
**Then** se inserta en `companies` con la separación de funciones activa por defecto
**And** la acción queda en `bitacora_plataforma` y en la `bitacora` de esa empresa, dentro de una sola transacción

**Given** un RFC que ya pertenece a otra empresa
**When** el dueño intenta crearla
**Then** se rechaza con un mensaje claro y no se crea nada

**Given** un RFC con formato inválido
**When** el dueño intenta crearla
**Then** se rechaza y nombra qué está mal

**Given** que el RFC se escribió en minúsculas o con espacios
**When** se guarda
**Then** se normaliza (mayúsculas, sin espacios) antes de compararlo y guardarlo

**Given** la empresa creada
**When** el dueño vuelve a su lista
**Then** la ve con su nombre y su RFC

**Given** que no se debe perder el aislamiento
**When** la migración otorga permisos para crear empresas
**Then** `cuadra_app` solo recibe los permisos de columna que esta historia necesita sobre `companies`

*Cubre: FR-39 (parte), FR-49. Arquitectura: AD-2, AD-5, AD-7.*

### Story 1.5: Invitar al primer administrador y aceptar la invitación por correo

As a dueño de Cuadra,
I want invitar por correo al primer administrador de una empresa,
So that el cliente entre sin que yo conozca ni maneje su contraseña.

**Acceptance Criteria:**

**Given** una empresa recién creada
**When** el dueño invita a un correo con el rol `admin`
**Then** se crea una invitación (clase 2) con un token de un solo uso guardado con hash y caducidad de 7 días
**And** `ProveedorCorreo` envía el mensaje con el enlace, y queda la acción `invitar` en la bitácora

**Given** que el correo ya tiene una cuenta o no la tiene
**When** el dueño invita
**Then** la respuesta es idéntica en los dos casos y no revela si el correo existe

**Given** un enlace de invitación vigente
**When** la persona lo abre y fija su contraseña
**Then** se crea su cuenta, o se reutiliza la que ya tenía, y recibe el rol `admin` en esa empresa
**And** la invitación se consume y la persona entra con una sesión

**Given** un enlace ya usado, caducado o reemplazado
**When** alguien lo abre
**Then** se rechaza con un mensaje claro y no cambia nada

**Given** el adaptador de correo
**When** el entorno es desarrollo o pruebas y no hay variables de correo
**Then** se usa el adaptador simulado, que guarda el mensaje donde las pruebas pueden leerlo
**And** en producción, sin las variables del correo real, el arranque falla nombrando cuáles faltan

**Given** la ruta que envía invitaciones
**When** se repite en exceso
**Then** aplica el límite de peticiones de la historia 1.2

*Cubre: FR-39, FR-40, FR-43 (invitaciones), FR-48, FR-61. Arquitectura: AD-14. Reenviar y cancelar invitaciones llega en la épica 2.*

### Story 1.6: Recuperar la contraseña por correo

As a persona de una empresa,
I want recuperar mi contraseña desde un enlace en mi correo,
So that pueda volver a entrar si la olvido sin pedirle nada al dueño.

**Acceptance Criteria:**

**Given** un correo, exista o no una cuenta con él
**When** la persona pide recuperar la contraseña
**Then** la respuesta es idéntica y no revela si el correo existe
**And** si existe, se envía un enlace con un token de un solo uso guardado con hash y caducidad de 1 hora

**Given** un enlace vigente
**When** la persona fija una contraseña nueva que cumple la política de la v1
**Then** se actualiza la contraseña, el token se consume y se borran todas las sesiones de ese usuario

**Given** un enlace usado o caducado
**When** alguien lo abre
**Then** se rechaza con un mensaje claro y no cambia nada

**Given** que se pide un enlace nuevo
**When** ya había uno vigente
**Then** el anterior deja de servir

**Given** la ruta de recuperación
**When** se repite en exceso
**Then** aplica el límite de peticiones de la historia 1.2

*Cubre: FR-43 (recuperación), FR-44. Arquitectura: AD-6, AD-14. La pantalla de olvidé mi contraseña necesita su mockup antes del código (UX-DR1).*

### Story 1.7: Levantar Cuadra en un entorno limpio, con secretos fuera del repositorio

As a dueño de Cuadra,
I want levantar Cuadra completa en una máquina limpia siguiendo un procedimiento escrito,
So that el despliegue sea repetible y no dependa de pasos que solo yo recuerdo.

**Acceptance Criteria:**

**Given** una máquina limpia con Docker
**When** sigo el procedimiento documentado
**Then** Docker Compose levanta PostgreSQL 18, Redis con política `noeviction`, la API y el worker
**And** las migraciones corren como un paso explícito, nunca al arrancar la API

**Given** que falta una variable de entorno obligatoria o se usa una credencial por defecto fuera de desarrollo
**When** arranca la API
**Then** falla con un mensaje que nombra la variable

**Given** el repositorio
**When** se revisa
**Then** existe un `.env.example` sin valores reales y los archivos con secretos están ignorados por git

**Given** el script de respaldo de PostgreSQL
**When** se ejecuta y el respaldo se restaura en una base limpia
**Then** las cuentas de filas de las tablas principales coinciden con las originales

**Given** la ruta de salud
**When** se consulta
**Then** informa el estado de PostgreSQL y de Redis

**Given** el procedimiento
**When** otra persona lo sigue sin ayuda
**Then** llega a una API en marcha sin pasos no escritos, y queda documentado cómo se elegirá el host cuando llegue un cliente real

*Cubre: FR-56, FR-60. Arquitectura: AD-16, AD-17.*

### Story 1.8: CI que construye la imagen y prueba el respaldo

As a dueño de Cuadra,
I want que la integración continua construya la imagen de producción y pruebe el respaldo,
So that un cambio al Dockerfile, al compose o al worker no llegue a `master` sin haberse ejercitado.

**Acceptance Criteria:**

**Given** un PR que cambia el `Dockerfile`, el compose, las migraciones o el worker
**When** corre la integración continua
**Then** se construye la imagen de producción y el trabajo falla si la construcción falla

**Given** la imagen construida
**When** arranca con las variables de producción de prueba
**Then** la API y el worker arrancan y `/health` informa PostgreSQL y Redis

**Given** la imagen construida y una base limpia
**When** se corre el paso `migrate`
**Then** las migraciones compiladas terminan sin error

**Given** la base migrada con datos de prueba
**When** corre `respaldar.sh --verificar`
**Then** el respaldo se restaura en una base limpia y los conteos coinciden, o el trabajo falla

**Given** credenciales de desarrollo con `NODE_ENV=production`
**When** arranca la API en la integración continua
**Then** falla nombrando la variable, y esa falla es la que se espera

**Given** el tiempo de la integración continua
**When** el cambio no toca infraestructura
**Then** estos trabajos no se ejecutan, para no alargar cada PR

*Cubre: FR-56, FR-60. Arquitectura: AD-17. Nace de la 1.7, donde la integración continua no construía la imagen ni probaba el respaldo.*

## Epic 2: Equipo y permisos por rol

El administrador invita a su gente, les da roles y los quita; cada rol ve y hace solo lo que le corresponde, y la bitácora muestra quién hizo qué.

### Story 2.1: Cada rol solo puede hacer lo que le corresponde

As a administrador de empresa,
I want que el servidor decida con una sola tabla de permisos qué puede hacer cada rol,
So that nadie pueda saltarse una regla manipulando la pantalla.

**Acceptance Criteria:**

**Given** la matriz de permisos de FR-53 (secciones y acciones por rol: `admin`, `contador`, `revisor`, `auditor` y dueño)
**When** se implementa
**Then** vive en un solo lugar del backend y se evalúa en el servidor
**And** una prueba de deriva la compara con su espejo del frontend

**Given** un endpoint de la v1 que hoy solo exige ser miembro de la empresa
**When** esta historia termina
**Then** declara el permiso que le corresponde en la matriz
**And** un endpoint nuevo sin permiso declarado falla una prueba de arquitectura

**Given** una persona con rol `auditor`
**When** intenta confirmar, rechazar, reabrir, descartar o cargar
**Then** recibe 403 y no cambia nada

**Given** una persona sin el permiso de la acción
**When** la intenta
**Then** recibe 403 y queda un acceso denegado en la bitácora con su rol y el permiso que faltaba

**Given** la matriz completa de FR-53
**When** una acción todavía no existe (por ejemplo verificar la muestra)
**Then** su fila ya está en la matriz y la historia que la construya solo la usa

**Given** que los roles se leen de la base en cada petición
**When** un administrador cambia el rol de alguien
**Then** el cambio aplica en su siguiente petición, sin cerrar su sesión

*Cubre: FR-25, FR-53, FR-55. Arquitectura: AD-11, AD-7 (acceso denegado ya existe en la v1).*

### Story 2.2: Cada rol ve solo su menú y sus botones

As a persona con cualquier rol,
I want ver solo las secciones y botones que puedo usar,
So that no me confunda con acciones que me van a rechazar.

**Acceptance Criteria:**

**Given** una persona con sesión de empresa
**When** el frontend pide su contexto
**Then** el servidor devuelve la lista de capacidades derivada de la matriz
**And** el frontend construye el menú y los botones solo a partir de esa lista

**Given** un `admin`, un `contador`, un `revisor` y un `auditor`
**When** cada uno entra
**Then** ven exactamente las secciones de la matriz de FR-53 (por ejemplo el revisor no ve Cargas ni Usuarios)

**Given** una persona con rol `auditor`
**When** abre la bandeja y la bitácora
**Then** ve el contenido pero ningún botón de acción

**Given** el código del frontend
**When** corren las pruebas
**Then** no queda ningún literal de rol en las pantallas
**And** `ROLES_QUE_EDITAN_TOLERANCIA` y `ROLES_QUE_CARGAN` desaparecen a favor de las capacidades del servidor

**Given** una persona con varios roles en una empresa
**When** entra
**Then** ve la unión de lo que le permiten sus roles

**Given** que el menú actual es una lista fija de cuatro elementos
**When** esta historia termina
**Then** el menú se filtra por capacidad y sigue el tema claro y oscuro (UX-DR2, UX-DR4, UX-DR5)

*Cubre: FR-25, FR-53, FR-54. Arquitectura: AD-11, AD-12.*

### Story 2.3: Invitar usuarios a mi empresa con uno o más roles

As a administrador de empresa,
I want invitar por correo a las personas de mi equipo y darles uno o más roles,
So that cada quien empiece a trabajar con el acceso correcto sin pasarme contraseñas.

**Acceptance Criteria:**

**Given** una persona con rol `admin`
**When** invita a un correo eligiendo uno o más roles entre `admin`, `contador`, `revisor` y `auditor`
**Then** se crea la invitación con token de un solo uso, caducidad de 7 días y los roles elegidos, y se envía el correo
**And** queda la acción `invitar` en la bitácora de la empresa con quién invitó y a qué roles

**Given** un correo que ya tiene una cuenta
**When** acepta la invitación
**Then** usa la misma cuenta y recibe los roles en esta empresa sin perder los que tenga en otras

**Given** una persona sin rol `admin`
**When** intenta invitar
**Then** recibe 403 y queda un acceso denegado

**Given** que la respuesta de invitar
**When** el correo existe o no existe
**Then** es idéntica y no revela si había cuenta

**Given** la ruta de invitar
**When** se repite en exceso
**Then** aplica el límite de peticiones de la épica 1

**Given** que la pantalla de administración de usuarios no tiene mockup
**When** se planea el código
**Then** el mockup se crea y se acuerda antes de escribir la interfaz (UX-DR1, UX-DR9)

*Cubre: FR-41, FR-50 (invitaciones). Arquitectura: AD-14, AD-7.*

### Story 2.4: Reenviar o cancelar una invitación pendiente

As a administrador de empresa,
I want reenviar o cancelar una invitación que nadie ha aceptado,
So that una invitación perdida no deje a alguien fuera ni deje un enlace abierto.

**Acceptance Criteria:**

**Given** una invitación pendiente
**When** el administrador la reenvía
**Then** se genera un enlace nuevo y el anterior deja de servir
**And** la caducidad vuelve a contar desde el reenvío

**Given** una invitación pendiente
**When** el administrador la cancela
**Then** el enlace deja de servir y la invitación desaparece de la lista de pendientes

**Given** una invitación ya aceptada
**When** el administrador intenta reenviarla o cancelarla
**Then** recibe un mensaje claro y no cambia nada

**Given** un reenvío o una cancelación
**When** se completan
**Then** quedan en la bitácora con quién y cuándo
**And** solo el rol `admin` puede hacerlo

*Cubre: FR-42, FR-50. Arquitectura: AD-14, AD-7.*

### Story 2.5: Ver la lista de usuarios de mi empresa

As a administrador de empresa,
I want ver quién tiene acceso a mi empresa y con qué roles,
So that sepa en cualquier momento quién puede hacer qué.

**Acceptance Criteria:**

**Given** una persona con rol `admin`
**When** abre Usuarios
**Then** ve cada usuario de su empresa con su correo, sus roles y si su invitación sigue pendiente

**Given** una persona con rol `contador`, `revisor` o `auditor`
**When** intenta abrir Usuarios o llamar a su endpoint
**Then** recibe 403 y la sección no aparece en su menú

**Given** un usuario con roles en varias empresas
**When** el administrador de una empresa ve la lista
**Then** solo ve los roles que ese usuario tiene en su empresa
**And** nunca ve las otras empresas de esa persona

*Cubre: FR-47. Arquitectura: AD-2, AD-11.*

### Story 2.6: Cambiar o quitar los roles de un usuario

As a administrador de empresa,
I want cambiar o quitar los roles de alguien de mi equipo,
So that cuando una persona cambia de trabajo o se va, pierda el acceso en ese momento.

**Acceptance Criteria:**

**Given** un usuario con roles en mi empresa
**When** el administrador le quita un rol o se lo cambia
**Then** el cambio aplica en su siguiente petición y queda en la bitácora como `cambiar_rol` o `quitar_rol`, con quién, cuándo y qué roles

**Given** un usuario al que se le quita su último rol en esta empresa
**When** se completa
**Then** pierde el acceso a esta empresa de inmediato y sus sesiones elegidas en ella dejan de servir
**And** conserva sus roles en otras empresas

**Given** el único `admin` de una empresa
**When** alguien intenta quitarle el rol o degradarlo
**Then** se rechaza con un mensaje claro hasta que exista otro `admin`

**Given** la migración de esta historia
**When** se revisan los permisos de `cuadra_app`
**Then** puede borrar filas de `user_company_roles` y de ninguna otra tabla de dominio

**Given** que `quitar_rol` y `cambiar_rol` son acciones nuevas
**When** se agregan
**Then** se registran en `tipos.ts`, en su espejo del frontend, en el `CHECK` de la migración y en la cuenta de la prueba de deriva

*Cubre: FR-45, FR-46, FR-50. Arquitectura: AD-2, AD-6, AD-7.*

### Story 2.7: Consultar la bitácora según mi rol

As a persona con rol `admin`, `contador`, `revisor` o `auditor`,
I want consultar la bitácora de mi empresa,
So that pueda demostrar qué se decidió, quién lo decidió y cuándo.

**Acceptance Criteria:**

**Given** una persona con cualquiera de los cuatro roles
**When** abre la bitácora
**Then** ve las entradas de su empresa, incluidas las de administración (invitar, cambiar rol, quitar rol) con textos en español

**Given** la bitácora
**When** alguien intenta modificar o borrar una entrada desde la aplicación o con el rol `cuadra_app`
**Then** no existe ninguna ruta ni permiso que lo permita
**And** una prueba lo comprueba

**Given** las entradas de acceso denegado
**When** se muestran
**Then** indican el rol, el permiso que faltaba y cuándo

**Given** una persona de otra empresa
**When** consulta la bitácora
**Then** no ve ninguna entrada de la empresa ajena

**Given** que la pantalla de la bitácora ya existe en la v1
**When** se agregan acciones nuevas
**Then** sigue el mockup aprobado y los textos de cada acción salen del dominio del backend (UX-DR1, UX-DR4)

*Cubre: FR-51 (y deja visibles FR-50, FR-55). Arquitectura: AD-7.*

## Epic 3: Cargar el estado de cuenta y las facturas

El contador sube el PDF de BBVA, el CSV y los CFDI de una empresa; el sistema cuadra los saldos, muestra una vista previa, evita duplicados y deja el historial de cargas.

### Story 3.1: Cargar CFDI y CSV sin duplicar nada

As a contador,
I want subir los CFDI del mes y el estado de cuenta en CSV,
So that mis facturas y movimientos queden en Cuadra sin repetirse aunque suba el archivo dos veces.

**Acceptance Criteria:**

**Given** una persona con rol `admin` o `contador`
**When** sube uno o varios CFDI en XML o un estado de cuenta en CSV
**Then** la carga se procesa y muestra cuántos registros entraron
**And** queda una entrada `cargar` en la bitácora con persona, fecha, archivo y resultado (FR-52)

**Given** un archivo ya cargado en la misma empresa
**When** se sube otra vez
**Then** responde que ya existía y no crea movimientos ni CFDI nuevos

**Given** un CSV con una falla del archivo (extensión, codificación, encabezados, formato)
**When** se sube
**Then** se rechaza completo con el motivo

**Given** un CSV con una fila mala
**When** se sube
**Then** se reporta `{fila, motivo}`, el resto se carga y la carga queda marcada "con filas rechazadas"

**Given** un CFDI en una moneda distinta de MXN
**When** se sube
**Then** se acepta pero queda marcado "moneda no soportada"

**Given** un estado de cuenta que no está en MXN
**When** se sube
**Then** se rechaza con el motivo

**Given** una persona con rol `revisor` o `auditor`
**When** intenta cargar
**Then** recibe 403 y la sección Cargas no aparece en su menú

*Cubre: FR-4, FR-5, FR-6, FR-9, FR-52 (parte). Ratifica el comportamiento de CU-08 y CU-09 de la v1 y agrega la marca de moneda. Arquitectura: AD-9, AD-16.*

### Story 3.2: Leer un PDF de BBVA y rechazar lo que no se puede leer

As a contador,
I want subir el PDF que bajo del portal de BBVA y ver cuántos movimientos se leyeron,
So that no tenga que capturar el estado de cuenta ni convertirlo a CSV.

**Acceptance Criteria:**

**Given** un PDF con texto del portal de BBVA
**When** el contador lo sube eligiendo el banco
**Then** un lector puro de BBVA devuelve el saldo inicial, el saldo final, los movimientos normalizados (los mismos campos que el CSV) y las líneas que no pudo leer
**And** la respuesta muestra cuántos movimientos se leyeron y no importa nada todavía

**Given** un PDF escaneado o sin texto
**When** se sube
**Then** se rechaza con un mensaje que pide el PDF descargado del portal del banco

**Given** un PDF mayor de 10 MB
**When** se sube
**Then** se rechaza con el motivo

**Given** un estado de cuenta que no está en MXN
**When** se lee
**Then** se rechaza con el motivo

**Given** el lector de BBVA
**When** se prueba
**Then** las pruebas usan texto de ejemplo y no el PDF binario
**And** el repositorio incluye al menos un PDF de ejemplo, público o sintético, marcado como tal y sin datos reales de personas

**Given** que la extracción del texto es un adaptador delgado
**When** se cambie la librería de lectura de PDF
**Then** el contrato del lector (texto en, saldos y movimientos fuera) no cambia

*Cubre: FR-1 (parte), FR-7. Arquitectura: AD-8. Deferred: la librería de extracción se elige y verifica aquí.*

### Story 3.3: Rechazar el PDF cuyos saldos no cuadran, y guardar el que sí

As a contador,
I want que Cuadra compruebe que saldo inicial más abonos menos cargos da el saldo final,
So that nunca se concilie con datos mal leídos.

**Acceptance Criteria:**

**Given** un PDF cuyo saldo inicial más abonos menos cargos no es igual al saldo final
**When** se sube
**Then** la carga se rechaza completa y el mensaje indica el motivo y las líneas que no se pudieron leer (UX-DR8)
**And** no se crea ninguna carga ni movimiento a medias

**Given** un PDF cuyos saldos cuadran
**When** se sube
**Then** se crea la carga en estado `pendiente_vista_previa` con sus movimientos en una zona de espera, todavía sin entrar a conciliación

**Given** el cuadre de saldos
**When** se revisa el código
**Then** lo hace una sola función común, que cualquier banco usa, y no cada lector por su cuenta
**And** los montos se comparan con aritmética decimal exacta, nunca como flotantes

**Given** una carga rechazada o creada
**When** termina
**Then** queda en la bitácora con persona, fecha, archivo y resultado

**Given** el nuevo estado `pendiente_vista_previa`
**When** se agrega
**Then** se registra en `tipos.ts`, en su espejo del frontend, en el `CHECK` de la migración y en la cuenta de la prueba de deriva

*Cubre: FR-1, FR-2, FR-52. Arquitectura: AD-8, AD-12, AD-16.*

### Story 3.4: Revisar la vista previa antes de importar

As a contador,
I want ver lo que Cuadra leyó del PDF y aceptarlo antes de que se concilie,
So that pueda corregir un problema de lectura a tiempo y no después de confirmar.

**Acceptance Criteria:**

**Given** una carga en `pendiente_vista_previa`
**When** el contador abre la vista previa
**Then** ve los movimientos leídos (fecha, monto, referencia), el número total y los saldos inicial y final (UX-DR7)

**Given** la vista previa
**When** el contador la acepta
**Then** los movimientos pasan a `movimientos`, la carga queda `procesada` y arranca la conciliación

**Given** la vista previa
**When** el contador la rechaza
**Then** la carga queda rechazada y no entra nada a movimientos

**Given** una carga en `pendiente_vista_previa`
**When** nadie la acepta
**Then** sus movimientos no aparecen en la bandeja ni se concilian

**Given** una persona sin permiso de cargar
**When** intenta aceptar o rechazar una vista previa
**Then** recibe 403 y queda un acceso denegado

**Given** que la pantalla de vista previa no tiene mockup
**When** se planea el código
**Then** el mockup se crea y se acuerda antes de escribir la interfaz (UX-DR1, UX-DR9)

*Cubre: FR-3 (parte). Arquitectura: AD-8, AD-4, AD-19 (la importación toma el candado de empresa).*

### Story 3.5: Detectar movimientos repetidos entre archivos

As a contador,
I want que Cuadra me avise cuando dos archivos traen el mismo movimiento,
So that no concilie dos veces el mismo pago cuando subo un PDF y un CSV del mismo mes.

**Acceptance Criteria:**

**Given** una función pura de huella (cuenta, fecha, monto y referencia normalizada)
**When** se importan movimientos
**Then** cada uno guarda su huella en `movimientos.huella`, con un índice no único por `(company_id, huella)`

**Given** una carga con movimientos que ya existen en la empresa
**When** el contador abre la vista previa
**Then** ve un resumen "N nuevos, M ya existentes" y confirma antes de importar (UX-DR7)

**Given** movimientos que ya existen
**When** el contador confirma
**Then** solo se importan los nuevos

**Given** un caso dudoso (misma huella, pero datos distintos en la referencia)
**When** se importa
**Then** entra como `pendiente_revision` y nunca se descarta solo

**Given** dos cargas simultáneas con los mismos movimientos
**When** se importan
**Then** la comprobación de huellas corre dentro del candado de empresa y ninguno se duplica

**Given** el nuevo estado `pendiente_revision`
**When** se agrega
**Then** se registra en `tipos.ts`, en su espejo y en el `CHECK`, y la prueba de deriva sigue en verde

*Cubre: FR-65. Arquitectura: AD-9, AD-19, AD-12.*

### Story 3.6: El dueño levanta la vista previa obligatoria de un banco

As a dueño de Cuadra,
I want exigir la vista previa en todas las cargas de un banco hasta tener evidencia de que su lector es confiable,
So that un lector nuevo nunca concilie nada sin que una persona haya visto lo que leyó.

**Acceptance Criteria:**

**Given** un banco cuya vista previa no se ha levantado
**When** cualquier empresa carga un PDF de ese banco
**Then** la vista previa es obligatoria (comportamiento de las historias 3.3 y 3.4)

**Given** la pantalla interna del dueño
**When** el dueño consulta un banco
**Then** ve cuántas cargas se han revisado en ese banco, calculado por consulta, y no un contador guardado

**Given** un banco con al menos cinco cargas revisadas
**When** el dueño levanta la obligación
**Then** queda registrada en `bancos_vista_previa` con quién y cuándo, y en `bitacora_plataforma` como `levantar_vista_previa`

**Given** un banco con menos de cinco cargas revisadas
**When** el dueño intenta levantarla
**Then** se rechaza con un mensaje claro

**Given** una persona de una empresa
**When** intenta levantar la obligación
**Then** recibe 403, porque la obligación se cuenta por banco en todo Cuadra y no por empresa

**Given** la obligación levantada
**When** se carga un PDF de ese banco
**Then** los movimientos pasan directo a conciliación sin pedir la vista previa, y el cuadre de saldos sigue aplicando

*Cubre: FR-3, FR-67 (parte). Arquitectura: AD-5, AD-8, AD-7 (nueva acción `levantar_vista_previa`).*

### Story 3.7: Ver el historial de cargas de mi empresa

As a contador,
I want ver la lista de cargas de mi empresa con su estado,
So that sepa qué se subió, cuándo y qué pasó con cada archivo.

**Acceptance Criteria:**

**Given** una persona con rol `admin` o `contador`
**When** abre Cargas
**Then** ve cada carga con su archivo, tipo, quién la subió, cuándo, su estado (procesada, rechazada, pendiente de vista previa, con filas rechazadas) y cuántos registros entraron

**Given** una carga rechazada
**When** la persona la abre
**Then** ve el motivo del rechazo y las líneas que no se pudieron leer

**Given** una carga `pendiente_vista_previa`
**When** aparece en la lista
**Then** ofrece abrir la vista previa

**Given** una persona de otra empresa
**When** abre Cargas
**Then** no ve ninguna carga de la empresa ajena

**Given** que la pantalla de cargas ya existe en la v1 (CU-24)
**When** se agregan los estados nuevos
**Then** sigue el mockup aprobado y los textos de cada estado salen del backend (UX-DR1, UX-DR4)

*Cubre: FR-8. Arquitectura: AD-2, AD-12.*

## Epic 4: Propuestas del motor

El motor propone parejas de factura y pago, incluidos los depósitos con varias facturas, sin cerrar nada; la confirmación pasa a ser una decisión con sus líneas sin perder los datos de la v1.

### Story 4.1: Preparar las tablas de decisiones y copiar los datos de la v1 sin perder nada

As a contador,
I want que mis propuestas y confirmaciones de la v1 sigan intactas cuando Cuadra cambie su modelo interno,
So that no pierda ni un caso ya conciliado.

**Acceptance Criteria:**

**Given** la base de datos de la v1 con filas en `conciliaciones`
**When** corre la migración de esta historia
**Then** se crean `decisiones` y `decision_lineas` con `company_id`, RLS con FORCE, su política y los GRANTs de `cuadra_app` en la misma migración (clase 1, AD-2)
**And** `decisiones` incluye `tipo`, `estado`, `origen`, `regla`, `score`, `lote_id`, `motivo`, `requiere_revision`, `huella_conjunto` y las columnas generadas `vigente` de AD-4

**Given** cada fila de `conciliaciones`
**When** se copia
**Then** nace una decisión con el mismo `id` y una línea con su factura
**And** el número de filas copiadas coincide con el original, y la bitácora histórica sigue apuntando a ids que existen

**Given** el esquema de `decision_lineas`
**When** se revisa
**Then** guarda `estado_decision` con clave foránea compuesta hacia `decisiones (id, estado)` con `ON UPDATE CASCADE`, y sus índices únicos parciales impiden dos líneas vigentes por factura y dos decisiones vigentes por movimiento

**Given** `huella_conjunto`
**When** se define
**Then** es una sola función SQL (ids ordenados y hasheados) con su espejo en TypeScript y una prueba de paridad, igual que `normalizar_referencia`

**Given** las tablas nuevas
**When** se registran
**Then** aparecen en `entidades.ts`, `TABLAS_CON_RLS` y `TABLAS_DOMINIO`, y las pruebas de aislamiento las cubren con datos de dos empresas

**Given** que el código todavía usa `conciliaciones`
**When** termina esta historia
**Then** la aplicación funciona exactamente como antes y todas las pruebas de la v1 siguen en verde

*Cubre: AD-4, AD-12, AD-20 (pasos 1 y 2). Habilita FR-11, FR-26 a FR-33.*

### Story 4.2: Pasar propuestas y confirmaciones al modelo de decisiones

As a contador,
I want confirmar y rechazar propuestas como siempre,
So that el cambio de modelo no cambie nada de lo que hago, pero ya soporte varias facturas por depósito.

**Acceptance Criteria:**

**Given** el motor de reglas
**When** genera propuestas
**Then** escribe filas en `decisiones` y `decision_lineas` y deja de escribir en `conciliaciones`

**Given** la bandeja, el detalle del caso y la resolución
**When** se consultan
**Then** leen de `decisiones` y muestran lo mismo que en la v1 para los mismos datos

**Given** una propuesta
**When** una persona la confirma
**Then** la transición `propuesta` a `confirmada` es un `UPDATE ... WHERE estado = 'propuesta'` con `rowCount` verificado
**And** las propuestas hermanas del movimiento pasan a `obsoleta` en la misma sentencia, y la factura y el movimiento cambian de estado en ella

**Given** dos confirmaciones simultáneas del mismo movimiento
**When** llegan al mismo tiempo
**Then** una gana, la otra recibe 409 y nunca un 500
**And** la acción toma el candado de empresa y bloquea las filas en el orden fijo de AD-19

**Given** una transición que no está en la tabla de AD-4
**When** se intenta
**Then** se rechaza con 409 y no cambia nada

**Given** un `CHECK` de coherencia
**When** se prueba
**Then** una decisión `confirmada` sin persona y fecha no se puede guardar (AD-3), y un `descarte` sin motivo tampoco

**Given** `ENTIDADES_BITACORA`
**When** se actualiza
**Then** suma `decisiones`, conserva `conciliaciones` para el historial, y cada transición escribe su fila de bitácora en la misma sentencia

*Cubre: AD-3, AD-4, AD-7, AD-19, AD-20 (paso 3). Habilita FR-14, FR-19, FR-27.*

### Story 4.3: Retirar la tabla vieja de conciliaciones

As a dueño de Cuadra,
I want eliminar la tabla `conciliaciones` cuando nada la use,
So that no queden dos fuentes de verdad para una confirmación.

**Acceptance Criteria:**

**Given** que ningún módulo del código nombra `conciliaciones`
**When** corre una prueba que lo verifica
**Then** la migración puede eliminar la tabla

**Given** la migración de retiro
**When** corre
**Then** borra la tabla y sus restricciones, y quita su registro de `entidades.ts`, `TABLAS_CON_RLS` y `TABLAS_DOMINIO`
**And** la bitácora histórica conserva sus filas y los textos de la entidad `conciliaciones`

**Given** una base con datos de la v1 ya migrados
**When** corren todas las migraciones en orden desde cero y sobre esa base
**Then** terminan sin error y el número de decisiones coincide con el de conciliaciones originales

**Given** la migración
**When** necesita revertirse
**Then** el procedimiento está documentado, porque `cuadra_app` no tiene `DELETE` y la reversión corre con el rol dueño de la migración

*Cubre: AD-20 (paso 4).*

### Story 4.4: Proponer una pareja de factura y pago, con su regla y confianza

As a contador,
I want que Cuadra me proponga qué factura corresponde a cada pago, diciéndome por qué,
So that revise parejas en vez de buscarlas a mano.

**Acceptance Criteria:**

**Given** una factura y un movimiento con la misma referencia y el mismo monto
**When** corre el motor
**Then** crea una propuesta con la regla `referencia_monto_exacto` y su puntuación más alta

**Given** las reglas 2 y 3 (`referencia_monto_diferente`, `monto_unico`)
**When** aplican
**Then** crean propuestas con menor confianza, ordenadas después de la regla 1, y el monto se compara con la tolerancia de la empresa

**Given** un CFDI en una moneda distinta de MXN
**When** corre el motor
**Then** no se empata y el caso queda con el motivo "moneda no soportada"

**Given** una pareja que una persona rechazó
**When** el motor corre de nuevo
**Then** no la vuelve a proponer, porque el conjunto `(movimiento, huella_conjunto)` en estado `rechazada` es único

**Given** el motor y la IA
**When** producen resultados
**Then** solo crean propuestas, nunca una decisión `confirmada`, y una prueba de arquitectura lo comprueba

**Given** cada propuesta
**When** se muestra
**Then** lleva su regla y su nivel de confianza, que coincide con la puntuación de la regla

*Cubre: FR-10, FR-13, FR-14, FR-15, FR-16. Arquitectura: AD-3, AD-4. Ratifica CU-12 y CU-15 de la v1.*

### Story 4.5: Proponer un depósito que cubre varias facturas

As a contador,
I want que Cuadra me proponga un depósito que paga varias facturas a la vez,
So that no tenga que sumar facturas a mano para encontrar cuáles cubre.

**Acceptance Criteria:**

**Given** un depósito y varias facturas de la misma contraparte (mismo RFC) **[SUPUESTO: se confirma contra el código de la v1]**
**When** exactamente un subconjunto suma el monto, dentro de la tolerancia de la empresa
**Then** el motor crea una sola propuesta con una línea por factura, y calcula la diferencia del grupo

**Given** un depósito donde varias combinaciones de facturas suman el mismo monto
**When** corre el motor
**Then** no propone nada
**And** el caso queda con sus candidatos y una explicación de por qué es ambiguo

**Given** la suma de las facturas fuera de la tolerancia
**When** corre el motor
**Then** no se propone

**Given** una propuesta de varias facturas
**When** se confirma
**Then** se confirman todas sus líneas juntas o ninguna, en una sola sentencia sobre la cabecera (AD-4)

**Given** una propuesta de varias facturas
**When** se muestra
**Then** nunca viene marcada para el lote y nunca se cierra sola

**Given** el índice de líneas vigentes
**When** una factura ya está en otra decisión confirmada
**Then** no puede entrar en una propuesta nueva

*Cubre: FR-11, FR-12. Arquitectura: AD-4.*

### Story 4.6: Sacar de las propuestas las facturas canceladas

As a contador,
I want que una factura cancelada deje de proponerse,
So that no concilie un pago contra un CFDI que ya no vale.

**Acceptance Criteria:**

**Given** un CFDI cuyo XML o dato cargado indica cancelación
**When** se carga o se actualiza
**Then** su estado pasa a `cancelada` y sus propuestas vivas pasan a `obsoleta`

**Given** una factura `cancelada`
**When** corre el motor
**Then** no la considera para ninguna propuesta

**Given** una factura cancelada que ya estaba en una decisión `confirmada`
**When** se detecta la cancelación
**Then** la decisión se marca con `requiere_revision` y queda visible en la bandeja
**And** Cuadra nunca la reabre sola

**Given** la cancelación
**When** ocurre
**Then** Cuadra no consulta al SAT, y la acción queda en la bitácora

**Given** el estado `cancelada`
**When** el CFDI de la v1 ya lo define pero nunca lo asigna
**Then** esta historia es la primera que lo asigna y la prueba de deriva sigue en verde

*Cubre: FR-66. Arquitectura: AD-4, AD-7.*

### Story 4.7: Sugerencias de la IA en los casos ambiguos

As a contador,
I want que la IA me sugiera candidatos y me explique por qué un caso es ambiguo,
So that decida con más contexto sin que la IA decida por mí.

**Acceptance Criteria:**

**Given** un caso ambiguo sin propuesta del motor
**When** corre el trabajo de sugerencias
**Then** la IA devuelve candidatos y una explicación que se guardan en `sugerencias_ia`

**Given** una sugerencia de la IA
**When** se muestra
**Then** nunca viene marcada, nunca cierra el caso y no crea una decisión `confirmada`

**Given** el proveedor de IA
**When** falla o no responde
**Then** el caso cae en la bandeja sin sugerencia y no se pierde

**Given** lo que se envía al proveedor
**When** se arma la petición
**Then** contiene solo la lista cerrada de campos del texto bancario, y una prueba falla si se agrega un campo fuera de esa lista

**Given** `ProveedorSugerencia`
**When** corren las pruebas
**Then** usan el proveedor falso o simulado y no llaman al LLM real

**Given** que las sugerencias leen decisiones
**When** el modelo cambia a `decisiones`
**Then** el módulo de sugerencias funciona sobre el modelo nuevo y toma el candado de empresa

*Cubre: FR-64. Arquitectura: AD-21, AD-19. La prueba real con el proveedor llega en la épica 7 (FR-62).*

## Epic 5: Revisar, confirmar y deshacer

La persona revisa la bandeja ordenada por confianza, confirma en lote o caso por caso, descarta, comenta y reabre con motivo, con la separación de funciones activa por defecto.

### Story 5.1: Ver la bandeja ordenada por confianza

As a contador,
I want ver los casos pendientes con las propuestas más seguras arriba,
So that empiece por lo que casi seguro está bien y deje para el final lo dudoso.

**Acceptance Criteria:**

**Given** una empresa con casos pendientes
**When** la persona abre la bandeja
**Then** ve cada caso con su factura o facturas, su movimiento, la diferencia y el motivo, ordenados por confianza (regla 1, luego regla 2, luego regla 3; los depósitos con varias facturas después de la regla 1) (UX-DR6)

**Given** un movimiento con una decisión vigente o con una carga en `pendiente_vista_previa`
**When** se arma la bandeja
**Then** no aparece como pendiente

**Given** una decisión con `requiere_revision`
**When** se arma la bandeja
**Then** aparece señalada de forma visible con el motivo de la revisión

**Given** un caso sin propuesta
**When** se muestra
**Then** conserva su motivo estable de "sin propuesta" y sus candidatos, si los hay

**Given** una persona de otra empresa
**When** abre la bandeja
**Then** no ve ningún caso de la empresa ajena

**Given** un monto largo
**When** se pinta
**Then** nunca se parte en dos líneas ni se sale de su caja, y la caja crece con el número (UX-DR3)

*Cubre: FR-17. Arquitectura: AD-4, AD-2. Ratifica CU-21 de la v1, ahora sobre `decisiones`.*

### Story 5.2: Confirmar o rechazar un caso individual

As a contador,
I want abrir un caso, ver sus candidatos y la explicación, y confirmarlo o rechazarlo,
So that resuelva con criterio los casos que no entran en un lote.

**Acceptance Criteria:**

**Given** un caso con propuesta
**When** la persona abre su detalle
**Then** ve la propuesta, sus candidatos y la explicación de por qué se propuso o por qué es ambiguo

**Given** una propuesta
**When** una persona con permiso la confirma
**Then** la decisión pasa a `confirmada` con persona y fecha, la factura y el movimiento quedan conciliados y la acción queda en la bitácora

**Given** una propuesta
**When** una persona la rechaza
**Then** la decisión pasa a `rechazada`, la factura sigue abierta y ese conjunto no se vuelve a proponer

**Given** una persona con rol `auditor`
**When** abre el detalle
**Then** ve el contenido sin botones de confirmar ni rechazar

**Given** que alguien más ya resolvió el caso
**When** la persona intenta confirmarlo o rechazarlo
**Then** recibe 409 con un mensaje claro y la pantalla se actualiza

*Cubre: FR-20. Arquitectura: AD-3, AD-4, AD-11, AD-19. Ratifica CU-15 y CU-23 de la v1.*

### Story 5.3: Confirmar un lote con la regla 1 ya marcada

As a contador,
I want confirmar de una vez todas las propuestas más seguras, desmarcando las que no me convencen,
So that concilie un mes en horas y no en días.

**Acceptance Criteria:**

**Given** la bandeja con propuestas
**When** la persona abre la confirmación en lote
**Then** solo las propuestas de la regla 1 vienen marcadas, y las de las reglas 2 y 3 y los depósitos con varias facturas vienen desmarcados

**Given** un lote con algunas propuestas desmarcadas
**When** la persona confirma
**Then** se confirman solo las marcadas, todas con el mismo `lote_id`, y cada una queda con persona, fecha y regla
**And** el lote no pide un motivo

**Given** una propuesta del lote que otra persona ya resolvió
**When** se confirma el lote
**Then** esa propuesta se omite, las demás se confirman y la respuesta informa cuántas se omitieron y por qué

**Given** una propuesta que la separación de funciones impide confirmar a esta persona
**When** se arma el lote
**Then** aparece desmarcada y deshabilitada con el motivo

**Given** una persona con rol `auditor`
**When** abre la bandeja
**Then** no ve la confirmación en lote

**Given** el lote confirmado
**When** se consulta
**Then** queda un identificador de lote y una entrada de bitácora por confirmación

*Cubre: FR-18, FR-19, FR-31. Arquitectura: AD-4, AD-7, AD-19. Es la historia que más reduce el tiempo de conciliación (SM-1).*

### Story 5.4: Separación de funciones activa por defecto

As a revisor,
I want que quien subió una carga no pueda confirmar sus propias conciliaciones,
So that una sola persona no cargue y apruebe sus propios datos.

**Acceptance Criteria:**

**Given** una empresa con la separación de funciones activa
**When** una persona intenta confirmar un caso cuya factura o cuyo movimiento vino de una carga que ella subió
**Then** recibe 403 con un mensaje claro y no cambia nada

**Given** la separación de funciones
**When** se revisa su configuración
**Then** `companies.separacion_funciones` es `true` por defecto
**And** si la configuración falta o su lectura falla, se aplica la separación (falla cerrada)

**Given** una confirmación en lote
**When** incluye propuestas que el usuario no puede confirmar
**Then** esas se excluyen como se describe en la historia 5.3

**Given** las pruebas
**When** corren
**Then** cubren los dos modos, separación activa y desactivada, y el caso de configuración ausente

*Cubre: FR-22. Arquitectura: AD-13. Ratifica la regla de CU-15 y la vuelve configurable.*

### Story 5.5: El dueño desactiva la separación de funciones y la empresa lo ve

As a dueño de Cuadra,
I want desactivar la separación de funciones para una empresa pequeña, dejando constancia de por qué,
So that un despacho de una sola persona pueda trabajar sin que la regla lo bloquee.

**Acceptance Criteria:**

**Given** la pantalla interna del dueño
**When** desactiva la separación de una empresa indicando un motivo
**Then** `separacion_funciones` pasa a `false` solo para esa empresa
**And** el motivo es obligatorio y sin él se rechaza

**Given** el cambio
**When** se completa
**Then** queda `desactivar_separacion` en `bitacora_plataforma` y en la bitácora de la empresa, en una sola transacción, con quién, cuándo y por qué

**Given** una persona de una empresa, incluso `admin`
**When** intenta cambiar la separación de funciones
**Then** recibe 403 y queda un acceso denegado

**Given** una empresa con la separación desactivada
**When** cualquiera de sus usuarios abre la bandeja o la bitácora
**Then** ve un aviso visible de que opera sin separación de funciones (UX-DR9)

**Given** el dueño
**When** vuelve a activar la separación
**Then** queda registrado igual, con motivo, y el aviso desaparece

**Given** la acción nueva `desactivar_separacion`
**When** se agrega
**Then** se registra en `tipos.ts`, en su espejo del frontend, en el `CHECK` y en la prueba de deriva

*Cubre: FR-23, FR-24, FR-67 (parte). Arquitectura: AD-5, AD-7, AD-13.*

### Story 5.6: Descartar un movimiento y deshacer el descarte

As a contador,
I want descartar los movimientos que no son de ningún cliente (comisiones, intereses) y poder arrepentirme,
So that la bandeja solo tenga casos que sí hay que resolver.

**Acceptance Criteria:**

**Given** un movimiento pendiente
**When** una persona con permiso lo descarta indicando un motivo
**Then** se crea una decisión `tipo = descarte` en estado `descartada` y el movimiento sale de la bandeja
**And** el motivo es obligatorio y sin él se rechaza

**Given** un movimiento descartado
**When** se consulta
**Then** sus propuestas no se muestran mientras siga descartado

**Given** un descarte
**When** lo deshace quien lo descartó o un `admin` **[SUPUESTO]**
**Then** la decisión pasa a `reabierta` y el movimiento vuelve a la bandeja como pendiente
**And** otra persona sin ese permiso recibe 403

**Given** descartar o deshacer un descarte
**When** se completan
**Then** quedan en la bitácora como `descartar` y `deshacer_descarte`, con persona, fecha y motivo

**Given** el índice de unicidad
**When** el movimiento ya tiene una decisión vigente
**Then** no se puede descartar de nuevo y la respuesta es 409

**Given** que descartar saca movimientos del denominador de SM-2
**When** se mide
**Then** cada descarte tiene su motivo guardado para poder auditarlo

*Cubre: FR-21. Arquitectura: AD-4, AD-7. Las acciones `descartar` y `deshacer_descarte` se registran en `tipos.ts`, su espejo, el `CHECK` y la prueba de deriva. La pantalla de deshacer necesita mockup antes del código (UX-DR9).*

### Story 5.7: Reabrir una confirmación y volver a confirmar

As a contador,
I want reabrir una confirmación que hice por error, con un motivo,
So that corrija un error sin borrar la historia de lo que pasó.

**Acceptance Criteria:**

**Given** una decisión `confirmada`
**When** la reabre un `admin` o quien la confirmó, indicando un motivo
**Then** pasa a `reabierta`, la factura y el movimiento vuelven a estar abiertos y el caso regresa a la bandeja como pendiente
**And** el motivo es obligatorio

**Given** la confirmación original
**When** se reabre
**Then** queda en el historial del caso y se puede consultar

**Given** una persona con rol `revisor` o `auditor`
**When** intenta reabrir una confirmación ajena
**Then** recibe 403 y queda un acceso denegado (el revisor solo puede reabrir lo que él confirmó)

**Given** un caso reabierto
**When** el motor corre de nuevo
**Then** puede generar propuestas nuevas, y la reconfirmación crea una decisión nueva que sigue las mismas reglas, incluida la separación de funciones

**Given** cada reapertura
**When** se completa
**Then** queda en la bitácora como `reabrir`, con persona, fecha y motivo

**Given** dos personas que reabren la misma confirmación a la vez
**When** llegan al mismo tiempo
**Then** una gana y la otra recibe 409

*Cubre: FR-26, FR-27, FR-28, FR-29, FR-30. Arquitectura: AD-4, AD-7, AD-19. La acción `reabrir` se registra en `tipos.ts`, su espejo, el `CHECK` y la prueba de deriva.*

### Story 5.8: Reabrir un lote completo

As a contador,
I want reabrir todo un lote de una vez cuando me di cuenta de un error general,
So that no tenga que deshacer una por una cientos de confirmaciones.

**Acceptance Criteria:**

**Given** un lote con varias confirmaciones vigentes
**When** un `admin` o quien lo confirmó lo reabre con un solo motivo
**Then** todas sus decisiones que sigan `confirmada` pasan a `reabierta` en una sola transacción, con los ids en orden ascendente

**Given** casos del lote que ya se habían reabierto o reconfirmado
**When** se reabre el lote
**Then** se omiten y la respuesta informa cuántos fueron y por qué

**Given** un lote reabierto
**When** se consulta la bitácora
**Then** queda una entrada por caso reabierto, con el mismo motivo y el identificador del lote

**Given** una persona sin permiso de reabrir
**When** intenta reabrir un lote
**Then** recibe 403 y queda un acceso denegado

**Given** una falla a la mitad
**When** la transacción no puede completarse
**Then** no se reabre ningún caso del lote y el motivo se muestra

*Cubre: FR-32, FR-33. Arquitectura: AD-4, AD-19.*

### Story 5.9: Dejar un comentario sobre una confirmación ajena

As a revisor,
I want dejar una observación sobre una confirmación que no me convence,
So that la contadora la vea dentro de la aplicación y decida, sin que yo pueda cambiar su trabajo.

**Acceptance Criteria:**

**Given** que la tabla de comentarios todavía no existe
**When** corre la migración de esta historia
**Then** se crea `decision_comentarios` (clase 1, solo agregar) con `company_id`, RLS con FORCE, su política y `SELECT` e `INSERT` para `cuadra_app`
**And** queda registrada en `entidades.ts`, `TABLAS_CON_RLS` y `TABLAS_DOMINIO`

**Given** una persona con permiso de comentar
**When** escribe un comentario de texto libre sobre un caso
**Then** se guarda en `decision_comentarios` con persona y fecha, se ve en el detalle del caso y queda en la bitácora como `comentar`

**Given** un comentario
**When** se guarda
**Then** no cambia el estado de la decisión ni reabre, rechaza o edita nada
**And** no se puede editar ni borrar

**Given** una persona con rol `auditor`
**When** abre el caso
**Then** puede leer los comentarios pero no ve el campo para escribir

**Given** una contadora que está de acuerdo con el comentario
**When** quiere actuar
**Then** reabre con la historia 5.7, porque el comentario no hace nada por sí solo

**Given** el texto de un comentario vacío
**When** se intenta guardar
**Then** se rechaza con un mensaje claro

*Cubre: FR-68. Arquitectura: AD-7, AD-11. La acción `comentar` se registra en `tipos.ts`, su espejo, el `CHECK` y la prueba de deriva. El comentario necesita mockup antes del código (UX-DR9).*

## Epic 6: Registro del modo sombra

Cuadra anota, sin cerrar nada, lo que habría cerrado sola y qué hizo la persona, y mide por empresa cuántos movimientos son PPD, parcialidades o comisiones.

### Story 6.1: Registrar lo que Cuadra habría cerrado sola

As a dueño de Cuadra,
I want que Cuadra anote cada propuesta de la regla 1 que habría cerrado sola, sin cerrar nada,
So that tenga datos reales para decidir algún día si es seguro el cierre automático.

**Acceptance Criteria:**

**Given** que el motor crea una propuesta de la regla 1 con candidata única, sin tolerancia ni ambigüedad
**When** se crea
**Then** se inserta una fila en `evidencia_sombra` con `evento = habria_cerrado`, la empresa, el banco, la decisión y la fecha

**Given** una propuesta de las reglas 2 o 3, o un depósito con varias facturas
**When** se crea
**Then** no se registra, porque nunca entran a la etapa 2

**Given** la fila de evidencia
**When** se revisa su permiso en base de datos
**Then** `cuadra_app` solo puede hacer `SELECT` e `INSERT`, y la fila lleva `company_id` con RLS (clase 1)

**Given** el registro
**When** se crea una propuesta
**Then** el insert ocurre en la misma transacción que la propuesta, para no perder evidencia, y no cambia el estado de nada

**Given** una empresa nueva
**When** cargue su primer mes
**Then** el registro empieza desde la fase 2a, aunque las pantallas lleguen en la fase 3

**Given** el nuevo valor `habria_cerrado`
**When** se agrega
**Then** se registra en `tipos.ts`, en su espejo del frontend, en el `CHECK` y en la prueba de deriva

*Cubre: FR-34, FR-38. Arquitectura: AD-3, AD-10, AD-2.*

### Story 6.2: Registrar qué hizo la persona después

As a dueño de Cuadra,
I want que Cuadra anote si la persona confirmó, rechazó, desmarcó o reabrió cada propuesta de la regla 1,
So that pueda calcular cuántas veces la persona no estuvo de acuerdo.

**Acceptance Criteria:**

**Given** una propuesta de la regla 1 con evidencia registrada
**When** una persona la confirma, la rechaza, la desmarca en un lote o la reabre más tarde
**Then** se inserta una nueva fila de `evidencia_sombra` con el evento `confirmo`, `rechazo`, `desmarco` o `reabrio`, la persona y la fecha
**And** nunca se actualiza ni se borra una fila anterior

**Given** una propuesta que la persona desmarcó y luego resolvió de otra forma
**When** se calcula la tasa de desacuerdo
**Then** cuenta como desacuerdo

**Given** una propuesta que la persona desmarcó y luego confirmó igual
**When** se calcula la tasa de desacuerdo
**Then** no cuenta como desacuerdo

**Given** un rechazo o una reapertura
**When** se calcula la tasa
**Then** cuentan como desacuerdo

**Given** la tasa de desacuerdo
**When** se consulta
**Then** se calcula con una consulta sobre los eventos y no se guarda en una tabla
**And** una prueba cubre cada uno de los casos anteriores con datos de dos empresas

**Given** los nuevos valores `confirmo`, `rechazo`, `desmarco` y `reabrio`
**When** se agregan
**Then** se registran en `tipos.ts`, en su espejo, en el `CHECK` y en la prueba de deriva

*Cubre: FR-35. Arquitectura: AD-10, AD-4, AD-12.*

### Story 6.3: Medir cuántos movimientos son PPD, parcialidades o comisiones

As a dueño de Cuadra,
I want saber, por empresa, cuántas facturas son PPD y cuántos movimientos son parcialidades o comisiones,
So that decida con datos si alguno de esos casos debe entrar a la v2.

**Acceptance Criteria:**

**Given** los CFDI de una empresa
**When** se consulta la fracción de PPD
**Then** es el número de facturas con método de pago PPD entre el total de facturas de esa empresa

**Given** un movimiento que se importa
**When** una función pura lo clasifica
**Then** se guarda en `movimientos.clase` como `comision`, `parcialidad` o nula, con criterios iniciales documentados en cada lector de banco **[SUPUESTO: se afinan con PDFs reales]**
**And** la clasificación nunca cambia la conciliación ni cierra nada

**Given** los movimientos clasificados de una empresa
**When** se consultan las otras dos fracciones
**Then** son los movimientos de clase `parcialidad` entre el total de movimientos, y los de clase `comision` entre el total de movimientos

**Given** las tres fracciones
**When** el dueño las consulta
**Then** las ve por empresa en un reporte de solo lectura, y se calculan por consulta, sin guardarse

**Given** un administrador o contador de una empresa
**When** intenta ver las fracciones de otra empresa
**Then** recibe 403, porque son de plataforma

**Given** el nuevo valor de clase
**When** se agrega
**Then** se registra en `tipos.ts`, en su espejo, en el `CHECK` y en la prueba de deriva

*Cubre: FR-69. Arquitectura: AD-10, AD-8. La pantalla de estas fracciones llega en la épica 9.*

## Epic 7: Demostrar de punta a punta

Los tres recorridos de usuario se prueban con la API, Postgres y Redis reales, con PDFs y datos de prueba, y hay una lista de verificación para cada demo.

### Story 7.1: Preparar los archivos de ejemplo del demo

As a dueño de Cuadra,
I want un juego de archivos de ejemplo (PDF, CSV y CFDI) que cuente una historia completa,
So that pueda demostrar y probar Cuadra sin usar datos de ninguna persona real.

**Acceptance Criteria:**

**Given** el repositorio
**When** se revisa la carpeta de ejemplos
**Then** hay al menos un PDF de estado de cuenta de BBVA con saldos que cuadran, los CFDI del mismo mes y un CSV equivalente
**And** cada archivo está marcado como sintético o público, y ninguno contiene nombres, cuentas, CLABE ni RFC de personas reales

**Given** el juego de ejemplo
**When** se carga completo
**Then** produce casos de todos los tipos: pagos con referencia y monto exactos (regla 1), con monto distinto (regla 2) y con monto único (regla 3), un depósito que cubre varias facturas, un caso ambiguo, una factura cancelada, un movimiento que es comisión y un PDF cuyos saldos no cuadran

**Given** un estado de cuenta real que una persona consiga de su asesor o de su banco
**When** quiere usarlo para probar
**Then** una guía corta explica cómo anonimizarlo (sin nombre, cuenta, CLABE ni RFC) y dice que nunca se sube al repositorio

**Given** los ejemplos
**When** corren las pruebas del lector de BBVA
**Then** usan el texto del PDF sintético y los resultados coinciden con los saldos y el número de movimientos esperados

**Given** la carpeta de ejemplos
**When** alguien la agrega a git
**Then** existe una regla (`.gitignore` o una prueba) que impide subir archivos marcados como reales

*Cubre: FR-70 (insumos). Arquitectura: AD-8, AD-18. Los PDF de Banorte y Santander se agregan en la épica 8.*

### Story 7.2: Probar de punta a punta: Carlos deja lista su empresa (UJ-2)

As a dueño de Cuadra,
I want una prueba que recorra el alta completa de una empresa y su equipo,
So that sepa que la puerta de entrada funciona antes de mostrársela a alguien.

**Acceptance Criteria:**

**Given** la API, PostgreSQL y Redis reales y el adaptador de correo simulado
**When** corre la prueba
**Then** el dueño inicia sesión, crea una empresa con un RFC, invita a un administrador y el administrador acepta la invitación leyendo el enlace del correo simulado

**Given** el administrador ya dentro
**When** invita a tres personas con distintos roles
**Then** cada una acepta y su menú muestra exactamente lo que le corresponde

**Given** una invitación pendiente
**When** la prueba la reenvía
**Then** el enlace anterior deja de servir y el nuevo funciona

**Given** el único administrador de la empresa
**When** la prueba intenta quitarle el rol
**Then** se rechaza

**Given** un administrador al que se le quita el rol de una empresa
**When** sigue con su sesión
**Then** pierde el acceso a esa empresa en su siguiente petición y conserva las otras

**Given** el CI del repositorio
**When** corre el flujo de integración
**Then** la prueba corre con PostgreSQL y Redis como servicios y falla el CI si el recorrido falla

*Cubre: FR-70 (UJ-2). Arquitectura: AD-18.*

### Story 7.3: Probar de punta a punta: Marisol concilia el mes (UJ-1)

As a dueño de Cuadra,
I want una prueba que recorra la conciliación de un mes completo,
So that sepa que el corazón de Cuadra funciona junto: cargas, motor, lote y reapertura.

**Acceptance Criteria:**

**Given** una empresa creada como en la historia 7.2
**When** la prueba sube el PDF sintético de BBVA y acepta la vista previa
**Then** los movimientos entran, y un PDF con saldos que no cuadran se rechaza completo con su motivo

**Given** los CFDI del mes
**When** la prueba los sube
**Then** el motor propone parejas ordenadas por confianza, un depósito con varias facturas desmarcado y una factura en dólares con la nota "moneda no soportada"

**Given** la bandeja
**When** la prueba confirma el lote de la regla 1
**Then** las decisiones quedan confirmadas con un solo `lote_id`, y la separación de funciones se respeta

**Given** un movimiento que no es de ningún cliente
**When** la prueba lo descarta con motivo
**Then** sale de la bandeja y se puede deshacer

**Given** una confirmación hecha por error
**When** la prueba reabre el lote con un motivo
**Then** los casos vuelven a la bandeja y la bitácora conserva quién y cuándo

**Given** los datos de otra empresa de prueba
**When** la prueba consulta la API con una sesión de la primera empresa
**Then** nunca ve datos de la otra

**Given** la prueba completa
**When** termina
**Then** no deja datos entre ejecuciones y corre en el CI

*Cubre: FR-70 (UJ-1). Arquitectura: AD-18, AD-2, AD-4.*

### Story 7.4: Probar de punta a punta: Pedro controla que el mes sea confiable (UJ-3)

As a dueño de Cuadra,
I want una prueba del recorrido del revisor,
So that sepa que quien controla el cierre ve lo correcto y no puede cambiar el trabajo ajeno.

**Acceptance Criteria:**

**Given** una empresa con un mes conciliado
**When** la prueba entra como `revisor`
**Then** su menú muestra solo la bandeja y la bitácora

**Given** la bandeja del revisor
**When** la prueba la consulta
**Then** ve lo que sigue sin resolver, con sus candidatos y su explicación

**Given** una confirmación ajena
**When** el revisor intenta reabrirla o editarla
**Then** recibe 403 y queda un acceso denegado

**Given** la misma confirmación
**When** el revisor deja un comentario
**Then** el comentario aparece en el detalle y en la bitácora, y el estado no cambia

**Given** un `auditor` en la misma empresa
**When** consulta la bandeja y la bitácora
**Then** ve el contenido sin ninguna acción disponible

**Given** que la verificación de la muestra mensual llega en la épica 9
**When** se complete esa épica
**Then** esta prueba se amplía para cubrir la verificación de la muestra

*Cubre: FR-70 (UJ-3). Arquitectura: AD-18, AD-11.*

### Story 7.5: Lista de verificación manual del demo

As a dueño de Cuadra,
I want una lista corta de pasos para comprobar a mano que pantalla y API trabajan juntas,
So that antes de cada demo sepa que todo funciona de verdad en el navegador.

**Acceptance Criteria:**

**Given** el repositorio
**When** se abre la lista
**Then** cubre los tres recorridos con la pantalla real: alta y equipo, conciliación de un mes, y revisión

**Given** cada paso
**When** se ejecuta
**Then** dice qué se debe ver, y si falla, qué se debe revisar

**Given** el tema claro y el oscuro
**When** se recorre la lista
**Then** incluye revisar una pantalla de cada flujo en los dos temas y comprobar que ningún monto se sale de su caja

**Given** un entorno recién levantado con la historia 1.7
**When** alguien sigue la lista
**Then** puede completarla en una sesión con los archivos de ejemplo de la historia 7.1

**Given** la lista
**When** termina un demo
**Then** hay un lugar para anotar la fecha, quién la corrió y qué falló

*Cubre: FR-70 (cierra el hueco de frontend y API reales juntos). Arquitectura: AD-18.*

### Story 7.6: Recorrido en navegador con Playwright (opcional)

As a dueño de Cuadra,
I want una prueba automática en navegador del recorrido de Marisol,
So that el demo no dependa solo de mi memoria.

**Acceptance Criteria:**

**Given** que la historia es opcional
**When** el tiempo no alcanza
**Then** puede omitirse sin afectar la puerta de la fase 2a, porque la lista manual de 7.5 la reemplaza

**Given** la API y el frontend reales levantados
**When** corre Playwright
**Then** recorre UJ-1 en un navegador: inicia sesión, sube el PDF, acepta la vista previa, confirma un lote y reabre

**Given** la prueba
**When** falla
**Then** guarda una captura de pantalla y no bloquea el CI obligatorio

*Cubre: FR-70 (opcional). Arquitectura: AD-18.*

### Story 7.7: Probar de verdad con el proveedor de IA antes de activarlo

As a dueño de Cuadra,
I want comprobar una vez, con el proveedor de IA real, que las sugerencias funcionan,
So that no active en producción algo que solo se probó con un proveedor simulado.

**Acceptance Criteria:**

**Given** una clave real del proveedor de IA
**When** corre la prueba real
**Then** envía un caso ambiguo de los datos sintéticos y recibe candidatos y una explicación válidos

**Given** la prueba real
**When** se revisa su petición
**Then** contiene solo la lista cerrada de campos permitida y ningún dato de una persona real

**Given** que la prueba cuesta dinero y depende de la red
**When** corre el CI
**Then** esta prueba no corre; solo corre cuando alguien la lanza a propósito con la clave

**Given** que la prueba real no se ha ejecutado con éxito
**When** alguien intenta activar el proveedor real en producción
**Then** el arranque lo impide o lo advierte con un mensaje claro

**Given** el resultado de la prueba
**When** termina
**Then** queda anotado con fecha, modelo usado y resultado

*Cubre: FR-62. Arquitectura: AD-21, AD-17.*

## Epic 8: Banorte y Santander

El contador carga también los PDF de Banorte y Santander, cada uno con su lector y su cuadre de saldos. Extiende FR-1, FR-2 y FR-7.

### Story 8.1: Leer un PDF de Banorte

As a contador,
I want subir el PDF que bajo de Banorte en su Empresa y que Cuadra lo lea como el de BBVA,
So that pueda conciliar una empresa cuyo banco es Banorte.

**Acceptance Criteria:**

**Given** un PDF con texto del portal de Banorte
**When** el contador lo sube eligiendo Banorte
**Then** un lector puro de Banorte devuelve el saldo inicial, el saldo final, los movimientos normalizados (los mismos campos que BBVA y el CSV) y las líneas que no pudo leer

**Given** el PDF leído
**When** sigue el flujo de las historias 3.3 y 3.4
**Then** pasa por la misma función común de cuadre de saldos, la misma vista previa y el mismo rechazo completo si no cuadra

**Given** un PDF escaneado, de más de 10 MB o que no está en MXN
**When** se sube
**Then** se rechaza con los mismos motivos y mensajes que para BBVA

**Given** el banco Banorte
**When** todavía no se ha levantado su vista previa
**Then** es obligatoria para todas las cargas de Banorte, y su conteo de cargas revisadas es independiente del de BBVA

**Given** un movimiento que se importa
**When** el lector lo clasifica
**Then** asigna `movimientos.clase` (`comision`, `parcialidad` o nula) con criterios documentados para este banco **[SUPUESTO: se afinan con PDFs reales]**, igual que en la historia 6.3

**Given** las pruebas del lector
**When** corren
**Then** usan texto de un PDF sintético o anonimizado de Banorte, marcado como tal, y nunca un estado de cuenta real en el repositorio

**Given** que el diseño del PDF cambia entre cuenta personal y empresarial
**When** se construye el lector
**Then** se escribe para la cuenta empresarial y rechaza con un mensaje claro un PDF cuyo diseño no reconoce

*Extiende: FR-1, FR-2, FR-7. Arquitectura: AD-8. Prerrequisito: un estado de cuenta empresarial de Banorte, anonimizado.*

### Story 8.2: Leer un PDF de Santander, incluso si trae contraseña

As a contador,
I want subir el PDF de Santander aunque venga protegido con contraseña,
So that no tenga que quitarle la protección por mi cuenta con otra herramienta.

**Acceptance Criteria:**

**Given** un PDF con texto del portal de Santander
**When** el contador lo sube eligiendo Santander
**Then** un lector puro de Santander devuelve saldos, movimientos normalizados y líneas no leídas, y pasa por el mismo cuadre, vista previa y rechazo que los otros bancos

**Given** un PDF protegido con contraseña **[SUPUESTO: una guía dice que los de Santander la piden; se verifica con un archivo real]**
**When** el contador lo sube
**Then** la pantalla le pide la contraseña, se usa solo en memoria para abrirlo y nunca se guarda ni se escribe en los registros

**Given** una contraseña incorrecta
**When** se intenta abrir el PDF
**Then** se rechaza con un mensaje claro y no se crea ninguna carga

**Given** un PDF sin protección
**When** se sube
**Then** no pide contraseña

**Given** el banco Santander
**When** todavía no se ha levantado su vista previa
**Then** es obligatoria para todas sus cargas, con su propio conteo

**Given** un movimiento que se importa
**When** el lector lo clasifica
**Then** asigna `movimientos.clase` (`comision`, `parcialidad` o nula) con criterios documentados para este banco **[SUPUESTO: se afinan con PDFs reales]**, igual que en la historia 6.3

**Given** las pruebas
**When** corren
**Then** incluyen un PDF sintético con contraseña y otro sin ella, y verifican que la contraseña no aparece en ningún registro

*Extiende: FR-1, FR-2, FR-7. Arquitectura: AD-8. Prerrequisito: un estado de cuenta empresarial de Santander, anonimizado.*

### Story 8.3: Los tres bancos cumplen el mismo contrato

As a dueño de Cuadra,
I want una prueba que obligue a BBVA, Banorte y Santander a comportarse igual,
So that agregar un cuarto banco no abra un camino distinto de cuadre o de rechazo.

**Acceptance Criteria:**

**Given** una prueba de contrato compartida
**When** corre contra los tres lectores
**Then** verifica que cada uno devuelve la misma forma de datos y que todos usan la misma función de cuadre

**Given** un PDF con saldos que no cuadran para cada banco
**When** se sube
**Then** los tres rechazan la carga completa con el mismo tipo de mensaje y sin dejar nada a medias

**Given** un banco cuyo PDF no trae saldo inicial y final **[SUPUESTO: se confirma con los PDF reales; hoy es hipótesis que sí los traen]**
**When** se lee
**Then** el lector marca la carga como "sin cuadre automático" y exige la vista previa de una persona, en vez de saltarse la comprobación

**Given** la lista de bancos en la pantalla de cargas
**When** el contador elige uno
**Then** ve BBVA, Banorte y Santander, tomados del backend (UX-DR4)

**Given** la puerta de salida de la fase 2b
**When** se evalúa
**Then** se cumple cuando los tres bancos cargan, cuadran y concilian un mes de ejemplo en la prueba de punta a punta de la épica 7

*Extiende: FR-1, FR-2, FR-7. Arquitectura: AD-8, AD-12, AD-18.*

## Epic 9: Medir y verificar

El dueño y el administrador ven la tasa de desacuerdo y el revisor verifica cada mes una muestra al azar de las confirmaciones en lote.

### Story 9.1: Ver la tasa de desacuerdo de mi empresa

As a administrador de empresa,
I want ver con qué frecuencia mi equipo no está de acuerdo con las propuestas de la regla 1,
So that sepa si puedo confiar en las propuestas más seguras de Cuadra.

**Acceptance Criteria:**

**Given** una empresa con eventos en `evidencia_sombra`
**When** el administrador abre la sección de medición
**Then** ve la tasa de desacuerdo de su empresa, con cuántas propuestas de la regla 1 se evaluaron y cuántas tuvieron desacuerdo

**Given** la tasa
**When** se calcula
**Then** sale de una consulta sobre los eventos, con la definición de la historia 6.2, y no de un número guardado

**Given** una persona con rol `contador`, `revisor` o `auditor`
**When** intenta abrir la medición
**Then** recibe 403 y la sección no aparece en su menú

**Given** una empresa sin propuestas de la regla 1 todavía
**When** el administrador abre la sección
**Then** ve un mensaje claro de que aún no hay datos, y no un cero engañoso

**Given** la administración de otra empresa
**When** consulta la medición
**Then** nunca ve los datos de la empresa ajena

**Given** que la pantalla no tiene mockup
**When** se planea el código
**Then** el mockup se crea y se acuerda antes de escribir la interfaz (UX-DR1, UX-DR9)

*Cubre: FR-36. Arquitectura: AD-10, AD-11.*

### Story 9.2: El dueño ve la tasa por banco y empresa, y las fracciones de PPD

As a dueño de Cuadra,
I want ver la tasa de desacuerdo desglosada por banco y por empresa, junto con las fracciones de PPD, parcialidades y comisiones,
So that decida con datos qué banco o qué tipo de caso merece atención.

**Acceptance Criteria:**

**Given** la pantalla interna del dueño
**When** abre la medición
**Then** ve la tasa de desacuerdo por banco y por empresa, con el número de propuestas evaluadas en cada una

**Given** la misma pantalla
**When** consulta una empresa
**Then** ve sus tres fracciones: facturas PPD sobre el total de facturas, movimientos de parcialidad sobre el total y comisiones sobre el total (historia 6.3)

**Given** una empresa con pocos datos
**When** se muestra una fracción
**Then** indica el tamaño de la muestra para que un porcentaje alto con pocos casos no engañe

**Given** una persona de una empresa
**When** intenta abrir la medición de plataforma
**Then** recibe 403 y queda un acceso denegado

**Given** los montos y porcentajes
**When** se pintan
**Then** respetan el tema claro y oscuro y no se salen de su caja (UX-DR2, UX-DR3)

*Cubre: FR-37, FR-69 (pantalla). Arquitectura: AD-5, AD-10.*

### Story 9.3: Generar la muestra de verificación del mes

As a revisor,
I want que Cuadra elija cada mes, al azar, un grupo de confirmaciones en lote para que las verifique,
So that confirmar un lote sin mirar no esconda los errores.

**Acceptance Criteria:**

**Given** el cierre de un mes en una empresa
**When** corre la generación de la muestra
**Then** elige al azar el 5% de las propuestas de la regla 1 confirmadas en lote ese mes, con un mínimo de 20 casos, o todas si hay menos **[SUPUESTO]**

**Given** la muestra generada
**When** se guarda
**Then** se inserta en `muestras_verificacion` con la empresa, el mes y las decisiones elegidas
**And** no se vuelve a sortear: ejecutar la generación otra vez para el mismo mes devuelve la misma muestra

**Given** una empresa sin confirmaciones en lote ese mes
**When** corre la generación
**Then** no crea muestra y registra que no había con qué

**Given** la generación
**When** corre
**Then** es un trabajo en segundo plano, idempotente por empresa y mes, que toma el candado de empresa

**Given** `muestras_verificacion`
**When** se revisa su permiso en base de datos
**Then** `cuadra_app` solo puede hacer `SELECT` e `INSERT`, con `company_id` y RLS (clase 1)

*Cubre: FR-63 (generación). Arquitectura: AD-10, AD-19, AD-16.*

### Story 9.4: Verificar la muestra, caso por caso

As a revisor,
I want revisar uno por uno los casos de la muestra y marcar cada uno como conforme o en desacuerdo,
So that confirme con evidencia que las confirmaciones en lote eran correctas.

**Acceptance Criteria:**

**Given** una muestra del mes
**When** el revisor la abre
**Then** ve cada caso con su factura, su movimiento y la regla, y los marca uno por uno como conforme o en desacuerdo

**Given** una empresa sin ninguna persona con rol `revisor`
**When** llega la muestra
**Then** la verifica el `admin`

**Given** que existe otra persona además de quien confirmó el lote
**When** se asigna la verificación
**Then** no la hace quien confirmó ese lote **[SUPUESTO]**

**Given** cada marca
**When** se guarda
**Then** queda con persona y fecha en `muestras_verificacion` y en la bitácora como `verificar_muestra`

**Given** un caso marcado en desacuerdo
**When** se guarda
**Then** no reabre nada por sí solo; la persona que lo decide usa la reapertura de la historia 5.7

**Given** una persona con rol `auditor`
**When** abre la muestra
**Then** puede verla pero no marcarla

**Given** la prueba de extremo a extremo de Pedro (historia 7.4)
**When** se completa esta historia
**Then** se amplía para cubrir la verificación de la muestra

**Given** que la acción `verificar_muestra` es nueva
**When** se agrega
**Then** se registra en `tipos.ts`, en su espejo, en el `CHECK` y en la prueba de deriva

*Cubre: FR-63. Arquitectura: AD-10, AD-11, AD-7. La pantalla de la muestra necesita mockup antes del código (UX-DR9).*

### Story 9.5: Saber si se cumple la condición para considerar el cierre automático

As a dueño de Cuadra,
I want ver si los datos cumplen la condición del PRD para considerar el cierre automático,
So that decida con evidencia y no por intuición si algún día activarlo.

**Acceptance Criteria:**

**Given** los datos de todas las empresas
**When** el dueño abre la condición
**Then** ve si hay al menos 1,000 propuestas de la regla 1, en al menos 3 empresas distintas y durante al menos 3 meses, y cuántas faltan para cada umbral

**Given** la tasa de desacuerdo
**When** se evalúa la condición (<= 0.5%)
**Then** se muestran por separado la tasa de las respuestas registradas y la de la muestra verificada
**And** la condición se evalúa con la más alta de las dos **[SUPUESTO: criterio conservador]**

**Given** que la condición se cumple
**When** el dueño la consulta
**Then** solo informa; no activa nada, y el cierre automático sigue sin existir en la v2

**Given** la condición
**When** cambia un dato (una reapertura, una verificación)
**Then** el resultado cambia en la siguiente consulta, porque se calcula y no se guarda

**Given** una persona de una empresa
**When** intenta abrir la condición
**Then** recibe 403, porque es de plataforma

*Cubre: FR-37 (parte), SM-C1. Arquitectura: AD-10, AD-3 (la etapa 2 queda fuera de la v2).*
