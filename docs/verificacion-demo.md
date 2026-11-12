# Lista de verificación manual del demo

Antes de cada demo, recorre esta lista con la pantalla y la API reales juntas.
Las pruebas automáticas (`src/e2e/`) cubren la API; esta lista cubre lo que ven
las personas en el navegador (historia 7.5, AD-18). Está pensada para una sola
sesión y usa los archivos de ejemplo de `ejemplos/bbva/` (historia 7.1).

Cada paso dice qué hacer, qué se debe ver y, si no se ve, qué revisar. Marca
`[x]` al cumplirlo y anota lo que falle en el [registro](#registro) del final.

## Antes de empezar

1. **Entorno limpio.** Sigue `docs/despliegue.md` con el compose de desarrollo
   (`docker compose -f docker-compose.dev.yml up -d --build`), corre
   `npm run migration:run` y `npm run seed` dentro del contenedor `api`, y
   siembra al dueño con `npm run sembrar:dueno` (las variables `DUENO_CORREO` y
   `DUENO_PASSWORD` van en tu `.env`). Comprueba `curl http://localhost:3000/health`.
2. **Frontend.** `cd frontend && npm install && npm run dev`, y abre
   <http://localhost:5173>.
3. **Log de la API.** En desarrollo el correo es simulado: el enlace de cada
   invitación sale en el log. Déjalo a la vista:
   `docker compose -f docker-compose.dev.yml logs -f api`.
4. **Si ya la corriste antes**, vuelve a empezar de cero con
   `docker compose -f docker-compose.dev.yml down -v` (borra todos los datos de
   desarrollo) y repite desde el paso 1.

Personas del seed (contraseña de todas: `cuadra-dev-2026`):

| Persona | Correo | Rol |
|---|---|---|
| Ana Reyes | `ana.reyes@fdb.mx` | administradora de Ferretería del Bajío |
| Luis Mendoza | `luis.mendoza@fdb.mx` | contador de Ferretería del Bajío |
| Carmen Olvera | `carmen.olvera@cuautla.mx` | administradora de Transportes Cuautla |
| Jorge Tapia | `jorge.tapia@despacho.mx` | contador en Ferretería, revisor en Transportes |

El dueño de la plataforma entra con el correo y la contraseña de tu `.env`.

Los números entre paréntesis son los de los mockups aprobados (el tablero del
canvas de Claude Design); el tema claro de cada uno va en su número «claro».

## Recorrido A. Alta y equipo

Mockups: 10 y 11 (plataforma), 12 y 13 (invitación), 16 y 17 (usuarios).

| | Qué hacer | Qué se debe ver | Si falla, revisa |
|---|---|---|---|
| [ ] A1 | Entra a `/plataforma/login` con el dueño. | La pantalla «Operación de la plataforma» con la lista de **Empresas** (Ferretería del Bajío y Transportes Cuautla). | `/health`; que `DUENO_CORREO` y `DUENO_PASSWORD` estén en `.env` y que hayas corrido `sembrar:dueno`. |
| [ ] A2 | «Crear empresa»: razón social `Demo Verificación SA de CV`, RFC `DVE260101AB1`, correo del administrador `admin-demo@ejemplo.test`, «Enviar invitación». | La empresa aparece en la lista y la invitación queda enviada. | Un RFC repetido se rechaza: usa otro. El log de la API trae el motivo. |
| [ ] A3 | Busca en el log «Correo simulado a admin-demo@ejemplo.test» y abre el enlace `/invitacion/…`. | «Te invitaron a administrar Demo Verificación SA de CV» y el formulario de cuenta nueva. | Sin línea en el log: `NODE_ENV=development` en `.env`. |
| [ ] A4 | Escribe un nombre y una contraseña corta (menos de 12 caracteres). Luego una de 12 o más y «Crear cuenta y entrar». | Con la corta: «La contraseña debe tener al menos 12 caracteres.». Con la buena entra a la bandeja de la empresa nueva, vacía. | El log de la API; que la invitación no haya caducado. |
| [ ] A5 | Cierra sesión. Entra como Ana → **Usuarios** → «Invitar a una persona»: `revisor-demo@ejemplo.test` con rol revisor; e «Invitar a otra persona»: `auditora-demo@ejemplo.test` con rol auditor. | Las dos aparecen en «Personas de tu empresa» con su invitación pendiente. | Luis no ve **Usuarios** (solo la administradora). Si Ana no lo ve, revisa que entró a Ferretería. |
| [ ] A6 | Acepta las dos invitaciones con los enlaces del log (crea las cuentas). | Cada persona entra a Ferretería y su menú muestra solo **Bandeja** y **Bitácora** (sin Cargas, Tolerancia ni Usuarios). | `GET /auth/contexto` en la pestaña Red: `capacidades` debe traer solo `bandeja.ver` y `bitacora.ver`. |

## Recorrido B. Conciliar el mes

Empresa: Ferretería del Bajío. Mockups: 1 y 9 (login), 4 (cargas), 18 (vista
previa), 2 y 7 (bandeja), 3 y 8 (detalle), 6 (bitácora).

| | Qué hacer | Qué se debe ver | Si falla, revisa |
|---|---|---|---|
| [ ] B1 | Entra como Luis. | «Inicia sesión» (Paso 1 de 2) y luego la **Bandeja** de Ferretería, vacía. El menú: Bandeja, Cargas, Bitácora y Tolerancia. | El mensaje «Correo o contraseña incorrectos»: que corriste `seed`. |
| [ ] B2 | **Cargas** → PDF BBVA: sube `ejemplos/bbva/estado-cuenta-septiembre-2026-no-cuadra.pdf`. | Se rechaza completo con el motivo de que los saldos no cuadran (la diferencia es de 100.00). No entra ningún movimiento. | Que sea el archivo `no-cuadra`; el log de la API. |
| [ ] B3 | Sube de una vez los nueve `ejemplos/bbva/cfdi/*.xml`. | La carga termina con 9 válidos y 0 con error. La factura `5009` queda marcada «Moneda no soportada · USD». | Carga atascada en espera: que Redis esté arriba (`/health`). En desarrollo la API consume las colas en el mismo proceso. |
| [ ] B4 | Sube `ejemplos/bbva/estado-cuenta-septiembre-2026.pdf`, entra a «Revisar vista previa» y acéptala. | La vista previa lista 8 movimientos; al aceptar, «Ir a la bandeja». | Que la vista previa muestre las 8 líneas; si no, el layout del PDF cambió. |
| [ ] B5 | Abre la **Bandeja**. | Seis casos por revisar. Cuatro con propuesta, de mayor a menor confianza: `1,160.00` (referencia `A5001`), `1,392.00` (un depósito con las facturas `5004` y `5005`), `2,300.00` (referencia `A5002`, monto distinto) y `3,480.00` (monto único). Dos sin pareja: `928.00` y `1,740.00`. | Que las facturas se hayan cargado antes y sean las de `ejemplos/bbva/cfdi` (su emisor es el RFC `FDB190215QK4`). |
| [ ] B6 | Como Luis, abre una propuesta (detalle) y prueba «Confirmar en lote» en la Bandeja. | Ve las propuestas con su motivo, pero no puede confirmarlas: quien subió los archivos no confirma. En el lote, sus filas quedan bloqueadas y no se marcan. | El aviso de separación de funciones; quién subió las cargas. |
| [ ] B7 | Cierra sesión. Entra como Ana → Bandeja → «Confirmar en lote». | Viene marcada solo la fila de `1,160.00` (regla 1); el depósito de `1,392.00` y las demás vienen desmarcadas. Déjalo así y confirma: aparece el recuadro del resultado con un caso confirmado y el botón «Reabrir lote». | Que Ana no sea quien subió los archivos. |
| [ ] B8 | En ese recuadro pulsa «Reabrir lote», escribe un motivo (sin motivo no deja) y confirma. Luego abre **Bitácora**. | «Lote reabierto: 1 caso.» y la fila de `1,160.00` vuelve a ser propuesta. En la bitácora hay un evento de reapertura con el nombre de Ana, el motivo y la fecha. | El recuadro solo aparece justo después de confirmar: si lo cerraste, confirma el lote otra vez. |
| [ ] B9 | Vuelve a «Confirmar en lote» con `1,160.00` marcada (la usa el recorrido C). | La fila queda conciliada; las demás siguen por revisar. | Ver B7. |
| [ ] B10 | Abre el movimiento de `1,740.00` → «Descartar movimiento» con un motivo. Luego «Deshacer descarte». | Al descartar sale de la bandeja; al deshacer vuelve. El motivo es obligatorio. | El permiso del rol; el log de la API. |
| [ ] B11 | Cierra sesión. Entra como Carmen (Transportes). | Su bandeja y su bitácora no muestran nada de Ferretería. | El aislamiento por empresa es una regla no negociable: un solo dato ajeno es un defecto grave. |

## Recorrido C. Revisión

Empresa: Ferretería del Bajío, con el revisor creado en A6. Mockups: 2, 3 y 6.

| | Qué hacer | Qué se debe ver | Si falla, revisa |
|---|---|---|---|
| [ ] C1 | Entra como `revisor-demo@ejemplo.test`. | El menú muestra solo **Bandeja** y **Bitácora**. | Ver A6. |
| [ ] C2 | Abre la Bandeja y un caso sin resolver. | Los pendientes con sus candidatos y su explicación (el motivo de cada propuesta). | Que el recorrido B haya dejado casos pendientes (B5). |
| [ ] C3 | Abre la confirmación de `1,160.00` que dejó Ana en B9 → «Reabrir confirmación» con un motivo. | Se rechaza (sin permiso) y la confirmación sigue conciliada. | El mensaje y el estado; la Bitácora debe registrar el acceso denegado (C6). |
| [ ] C4 | En la misma confirmación escribe en «Dejar un comentario» y «Comentar». | El comentario aparece en el detalle y como evento en **Bitácora**; el caso sigue conciliado. | Que el texto no esté vacío ni exceda el límite. |
| [ ] C5 | Entra como `auditora-demo@ejemplo.test`. | Ve **Bandeja** y **Bitácora**, con el mismo contenido, y ninguna acción: ni confirmar, ni descartar, ni comentar, ni reabrir. | Ver A6. |
| [ ] C6 | Entra como Ana → **Bitácora** y filtra por acción «acceso denegado». | Hay una entrada del revisor por el intento de C3. | El filtro de acción y las fechas. |
| [ ] C7 | _Pendiente (épica 9)_: verificación de la muestra mensual. | Se agrega aquí cuando exista. | — |

## Temas claro y oscuro

El control del tema está en el encabezado: «☀ Claro», «◐ Sistema» y «☾ Oscuro».
Revisa una pantalla de cada recorrido en los dos temas y compárala con su
mockup:

| | Pantalla | Mockups (oscuro / claro) | Qué se debe ver |
|---|---|---|---|
| [ ] T1 | **Usuarios** (recorrido A) | 16 / 17 | Textos legibles y roles visibles en los dos temas. |
| [ ] T2 | **Bandeja** (recorrido B) | 2 / 7 | Igual, y los montos de la columna «Monto» completos. |
| [ ] T3 | **Detalle del caso** (recorrido C) | 3 / 8 | Igual, y los montos de las propuestas completos. |

En cada una, **ningún monto se sale de su caja**: no se parte en dos líneas y la
caja crece con el número. Estrecha la ventana a unos 1024 px y vuelve a mirar
los montos de la Bandeja y de la vista previa del PDF (18).

## Registro

Anota una fila por cada vez que se corre la lista.

| Fecha | Quién la corrió | Pasos que fallaron | Qué se hizo |
|---|---|---|---|
| | | | |
