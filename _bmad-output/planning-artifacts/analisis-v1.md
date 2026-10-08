---
titulo: Análisis de la v1 de Cuadra
autora: Mary (Analista de negocio, BMAD)
fecha: 2026-10-08
fuentes: CUADRA.md, código del backend (src/) y del frontend (frontend/)
estado: borrador para planear la v2
---

# Análisis de la v1 de Cuadra

## 1. Conclusión

La v1 está completa y es sólida en lo que prometió: 26 de 26 historias, con las reglas
no negociables respetadas en el código (`company_id` en cada consulta, montos en
`NUMERIC`, RLS con FORCE, el LLM solo sugiere). Lo que le falta no es funcionalidad
de dominio sino todo lo que separa un prototipo bien hecho de un producto operable:
despliegue, seguridad de red, moneda, formatos de entrada reales y escala.

Hay además una divergencia de producto que conviene resolver antes de planear: el
documento (`CUADRA.md`) sugiere conciliación automática y el sistema **nunca cierra un
caso sin confirmación humana**. El código es más conservador que el diagrama.

## 2. Método y nivel de evidencia

Se leyó `CUADRA.md` completo y se cruzó con el código del backend y del frontend
mediante dos exploraciones de solo lectura. Después se contrastaron a mano los tres
hallazgos de mayor impacto (ver 6.1, 6.2 y 6.3).

| Dato | Estado |
|---|---|
| 3,946 pruebas de frontend pasan (239 archivos), `tsc` y `eslint` limpios | Verificado en esta sesión |
| 852 pruebas de backend con Postgres 18 | Tomado de `docs/bitacora.md`; no se volvió a ejecutar |
| Revisión visual de bitácora y tolerancia en navegador | No verificada por el análisis (el usuario indicó que ya la revisó) |
| Responsive, accesibilidad real, error boundary global | No verificado |

## 3. Qué es la v1 hoy

**Backend (NestJS, PostgreSQL, Redis).**
- Autenticación con selección de empresa y roles `admin`, `contador`, `revisor`.
- Cargas de CFDI 4.0 (XML) y de estados de cuenta (CSV con perfiles de banco).
- Motor de reglas determinista: `referencia_monto_exacto` (1.0), `referencia_monto_diferente`
  (0.5) y `monto_unico` (0.4), con siete motivos de "sin match".
- Tolerancia de monto configurable por empresa (solo en MXN).
- Sugerencias de IA detrás de una interfaz, con adaptador Anthropic, simulado y apagado.
- Confirmar y rechazar con segregación de funciones (quien subió una carga no confirma).
- Bitácora de auditoría append-only. Aislamiento por empresa con RLS FORCE y rol sin BYPASSRLS.

**Frontend (React 19, Vite, TanStack Query, CSS Modules).**
- Siete rutas reales: login, empresa, bandeja, detalle del caso, cargas, tolerancia, bitácora.
- Tema claro y oscuro con selector. Sin colores fuera de tokens.
- Reglas de dinero reforzadas con una regla ESLint propia y pruebas, no solo por convención.
- Los valores del dominio se copian a mano desde el backend y se vigilan con pruebas de deriva.

## 4. Divergencias entre CUADRA.md y el código

| # | El documento dice | El código hace | Acción sugerida |
|---|---|---|---|
| D1 | Diagrama con "conciliado por evidencia fuerte" | El motor solo propone; toda conciliación la confirma una persona | Decisión de producto (ver 8.1) |
| D2 | Estados de CFDI: abierta, conciliada, cancelada | Existe además `parcialidades`; `cancelada` nunca se asigna | Corregir doc; decidir si `cancelada` se usará |
| D3 | Seis tablas de dominio | Hay ocho: faltan `carga_archivos` y `sugerencias_ia` | Corregir doc |
| D4 | Match por monto, fecha, RFC y referencia | La fecha solo filtra compatibilidad; el RFC solo filtra por emisor | Corregir doc |
| D5 | Bitácora registra cargas | La acción `cargar` existe pero nada la escribe | Corregir código o doc (ver 6.2) |
| D6 | Seis acciones de bitácora | Hay siete: se agregó `acceso_denegado` | Corregir doc |
| D7 | Variables de entorno de la tabla D-10 | Hay más: `LLM_PROVEEDOR`, `COLA_*` | Corregir doc |
| D8 | "Tres contenedores y un comando" | El frontend no está en `docker-compose.yml` | Corregir doc o agregar el servicio |
| D9 | Sesión "en memoria" | Correcto, pero no se declara como limitación de producto | Documentar como límite |
| D10 | Roles por pantalla | Definidos en el frontend (`ROLES_QUE_CARGAN`, `ROLES_QUE_EDITAN_TOLERANCIA`) sin documentar | Documentar la matriz de permisos |

## 5. Cumplimiento de las reglas no negociables

| Regla | Resultado |
|---|---|
| Toda consulta de dominio filtra por `company_id` | Sin violaciones halladas (muestreo por proximidad, no análisis de cada consulta) |
| Montos en `NUMERIC`, nunca flotante | Cumple; `decimal.js`, `numeric(18,4)`, y regla ESLint en el frontend |
| Columnas en `snake_case` | Cumple (`SnakeNamingStrategy`) |
| El motor decide, el LLM solo sugiere | Cumple; el LLM solo inserta `origen='llm'`, `estado='propuesta'` |
| Un falso positivo es peor que no conciliar | Cumple; es la causa de D1 |
| Tabla nueva: `company_id`, RLS FORCE, política, GRANT | Cumple, incluidas `carga_archivos` y `sugerencias_ia` |

Matiz: `companies`, `users` y `user_company_roles` quedan fuera de RLS por diseño
(`AislamientoRls.ts:8-10`). La app tiene SELECT global sobre ellas; el aislamiento
depende de disciplina de código.

## 6. Hallazgos de mayor impacto (verificados)

1. **La moneda del movimiento bancario nunca se asigna al importar.** La columna
   `movimientos.moneda` tiene `default 'MXN'` (`src/bancos/movimiento.entity.ts:96`) y ningún
   lector de estados de cuenta la fija. Un CFDI en otra moneda nunca puede empatar con un
   movimiento. Además la tolerancia solo aplica en MXN.
2. **Las cargas no dejan rastro en la bitácora.** La acción `cargar` está permitida por el
   CHECK de la tabla, pero ninguna línea del código la escribe. Para un producto cuyo valor
   es la trazabilidad, es una omisión llamativa.
3. **El menú no se filtra por rol.** `Sidebar.tsx` recorre `ELEMENTOS_NAV` completo. Un
   revisor ve Tolerancia y Bitácora y descubre su falta de permiso con un 403.

## 7. Brechas para llegar a producción

**Despliegue y operación.** Solo existe `Dockerfile.dev`. No hay imagen de producción del
backend ni del frontend, ni servidor para el frontend, ni proxy que reescriba `/api`, ni
estrategia para correr migraciones. Las credenciales por defecto del compose y los puertos
publicados no son aptos para producción.

**Seguridad.** Sin CORS, helmet ni rate limiting. El bloqueo de cuenta se delega a un proxy
que no existe. Sin refresh token ni logout en servidor; un F5 cierra la sesión y el token dura
15 minutos.

**Observabilidad.** Solo `/health` y el logger de Nest. Sin métricas, trazas ni correlación.

**Cobertura funcional.**
- Solo conciliación uno a uno. Quedan fuera pagos que cubren varias facturas, comisiones,
  PPD con complemento de pago, egresos y notas de crédito.
- Solo se concilian abonos; los cargos nunca entran al motor.
- Formatos: CSV (dos perfiles de banco sintéticos) y CFDI 4.0. Sin PDF, OFX, MT940 ni bancos reales.
- Sin altas de empresas, usuarios ni roles desde la app; solo el seed los crea.

**Escala.** El motor carga en memoria todos los movimientos y CFDI abiertos de la empresa. Los
archivos se acumulan en memoria como `Buffer`. La cola corre en un solo worker dentro del
proceso de la API.

**Calidad.** No hay pruebas e2e: todo el frontend corre contra MSW y nunca contra la API
real. CUADRA.md ya admite que falta probar una subida real de archivos. La prueba de humo
contra Anthropic sigue como riesgo abierto, y se envía texto bancario a un tercero.

## 8. Decisiones de producto que la v2 debe tomar

> **Nota (2026-10-08):** estas decisiones se refinaron al escribir el PRD (`_bmad-output/planning-artifacts/prds/prd-cuadra-2026-10-08/prd.md`). Donde difieren, manda el PRD: se agregó el rol `auditor`, la separación de funciones pasó a ser configurable por empresa (la desactiva solo el dueño de Cuadra) y la matriz de permisos quedó cerrada.

1. **Automatización. DECIDIDO (2026-10-08): B con modo sombra primero, A por empresa después.**
   Etapa 1: el sistema marca qué casos cerraría solo, pero no cierra ninguno; una persona
   confirma en lote y se mide la tasa real de rechazos (la v1 solo tiene datos sintéticos).
   Etapa 2: cierre automático solo si esa tasa es cercana a cero, solo para la regla más
   estricta (referencia y monto exactos, candidata única, sin tolerancia ni ambigüedad), con
   actor "sistema", reversible, lista de "cerrados automáticamente" para revisión por muestreo
   y activación por empresa. Esto exigirá cambiar `ck_conciliaciones_confirmada_requiere_persona`
   en la etapa 2, no en la 1.
   *Historial de la discusión:* se respondió "confirmación humana siempre" y
   el usuario la cuestionó: la promesa original de `CUADRA.md` (líneas 3-4 y 46) es
   conciliación automática con revisión humana solo en los casos dudosos, y el dolor de
   origen eran días de empate manual. La restricción
   `ck_conciliaciones_confirmada_requiere_persona` impide hoy cualquier cierre sin persona,
   así que el diagrama y el modelo de datos se contradicen. Opciones: (A) cierre automático
   de la evidencia más fuerte, reversible y auditado con actor "sistema"; (B) confirmación en
   lote por una persona. Recomendación del análisis: B primero, A como opción por empresa
   después. Pendiente de decisión del usuario.
2. **Alcance de moneda. DECIDIDO (2026-10-08): la v2 es solo MXN.** Consecuencia: el
   hallazgo 6.1 deja de ser un bloqueo, pero no debe quedar silencioso. Un CFDI en otra
   moneda hoy nunca empata y nadie sabe por qué; en la v2 debe declararse explícitamente
   (por ejemplo, un motivo "moneda fuera de alcance" visible en la bandeja) en vez de
   quedar como un "sin match" sin explicación.
3. **Cobertura de casos. DECIDIDO (2026-10-08): prioridad al pago que cubre varias facturas
   (un movimiento, varios CFDI).** Es el caso más frecuente del usuario. Consecuencias:
   - El modelo de la v1 lo bloquea: según `CUADRA.md` (líneas ~442-445) hay un índice único
     parcial que permite **una sola conciliación confirmada por movimiento** y otro por CFDI.
     La v2 debe permitir varias confirmadas por movimiento, conservando "un CFDI, una sola
     confirmada". No verificado directamente en la migración; confirmar en el diseño.
   - Es un problema de combinaciones (qué subconjunto de facturas suma el monto). Con la regla
     "un falso positivo es peor que no conciliar", el motor solo debe **proponer** el
     subconjunto cuando sea único e inequívoco; con varias combinaciones posibles, va a la
     bandeja sin proponer.
   - Estos casos quedan fuera del cierre automático de la decisión 1 (etapa 2 solo cubre
     referencia y monto exactos, candidata única): siempre los confirma una persona.
   - Pendiente de decidir más adelante: parcialidades (varios pagos, una factura) y comisiones
     bancarias. No se descartan, no son la prioridad.
4. **Entradas. FORMATOS DECIDIDOS, BANCOS PENDIENTES (2026-10-08).**
   - Formato prioritario: **PDF descargado del portal** (con texto), leído con reglas por
     banco. `CUADRA.md` D-02 ya lo señalaba como "la primera deuda a pagar".
   - Salvaguardas: cuadre de saldos (saldo inicial + abonos − cargos = saldo final; si no
     cuadra, la carga se rechaza antes del motor) y vista previa humana al inicio.
   - PDF escaneado o foto: después, con OCR o IA y vista previa humana obligatoria; mientras
     tanto se puede pedir al cliente el PDF del portal.
   - CSV y Excel: secundarios. Todos los lectores producen el mismo movimiento normalizado.
   - Bancos de los primeros usuarios: **BBVA, Banorte y Santander**. Reemplazan a los dos
     perfiles sintéticos de la v1.
   - Dependencia: se necesitan estados de cuenta PDF reales de cada banco (anonimizados) para
     construir y probar los lectores. Sin muestras no se puede validar el cuadre de saldos.
   - Pendiente de averiguar: si cada banco cambia el diseño del PDF según el tipo de cuenta
     (personal, empresarial), lo que multiplicaría los perfiles.
5. **Administración. DECIDIDO (2026-10-08): alta por invitación y aprobación manual del
   dueño de Cuadra; el administrador de cada empresa gestiona a sus propios usuarios.**
   - Flujo: el dueño de Cuadra aprueba la empresa (conoce a la persona, lo que cubre el robo
     de RFC en la etapa inicial). Después, el `admin` de la empresa invita por correo con rol
     (`admin`, `contador`, `revisor`); la persona define su contraseña con un enlace. Una persona
     ya existente puede unirse a otra empresa (el modelo `user_company_roles` ya lo permite).
   - Reglas: un RFC solo bloquea a otros cuando está verificado; no se puede quitar al último
     `admin`; toda alta, baja y cambio de rol va a la bitácora; la separación de funciones se
     mantiene.
   - Requisitos nuevos: envío de correos, recuperación de contraseña, y una vía de escritura con
     permisos propios para `companies`, `users` y `user_company_roles` (hoy `cuadra_app` no puede
     crearlos). Esas tablas están fuera de RLS por diseño: deben tocarse solo por esa vía y con
     pruebas que demuestren que un usuario no puede listar ni unirse a empresas ajenas.
   - Se pospone: registro abierto al público y verificación del RFC con e.firma (firma del reto
     en el navegador para que la llave privada no salga de ahí; confirmar detalles en el diseño).
   - Pendiente: si un despacho contable llevará varias empresas con un solo acceso.
6. **Quién ve qué. DECIDIDO (2026-10-08).**
   - Bitácora: la ven `admin`, `contador` y `revisor`. **Nadie la modifica ni la borra desde la
     aplicación, ni siquiera el admin**, porque la bitácora también audita al admin. La v1 ya
     lo cumple (tabla de solo agregar). Un error se corrige con una nueva entrada; una depuración
     por antigüedad sería una tarea de mantenimiento fuera de la aplicación.
   - El menú muestra a cada rol solo lo que puede usar (hoy muestra todo y el servidor responde 403).
   - Pendiente: matriz completa del resto de pantallas (bandeja, caso, cargas, tolerancia), que
     hoy está definida en el frontend (`ROLES_QUE_CARGAN`, `ROLES_QUE_EDITAN_TOLERANCIA`) y sin
     documentar.

## 9. Deuda técnica menor

- Código muerto: `shared/ui/MarcadorPendiente.tsx` y su CSS.
- Comentarios obsoletos en `frontend/src/shared/api/client.ts:6-12` ("en CU-20 no hay sesión").
- Nombre truncado `TolerPage.tsx`.
- Archivos densos: `lector-cfdi.ts` (419 líneas), `cargas.service.ts` (399),
  `resolucion.service.ts` (396), `lector-estado-cuenta.ts` (395), `evaluar-par.ts` (377).
- Cálculo de presentación `dentroDeTolerancia` en el cliente: hoy es solo visual; vigilar que
  no se vuelva autoritativo.
- Estados sin transición en el código: `cancelada` (verificado) y posiblemente `descartado`
  (no verificado).
- Pruebas de deriva que exigen el repositorio completo; quien trabaje solo en `frontend/` puede
  romperlas sin entender por qué.

## 10. Riesgos ordenados

| Riesgo | Nivel | Por qué |
|---|---|---|
| El producto se describe distinto de lo que hace (D1) | Alto | Expectativa de automatización que el sistema no cumple |
| Exposición pública sin rate limiting ni CORS | Alto | Primer despliegue real queda desprotegido |
| Sin camino de despliegue de producción | Alto | Cada decisión pendiente bloquea el primer cliente |
| Moneda siempre MXN | Alto | Bloquea casos reales con CFDI en USD |
| Sin e2e contra la API real | Medio | Un cambio de contrato rompe pantallas sin aviso |
| Cargas sin auditoría | Medio | Debilita la propuesta de trazabilidad |
| Sesión frágil | Medio | Expulsa al usuario durante revisiones largas |
| Prueba real con el LLM sin hacer | Medio | Riesgo abierto de coste, latencia y privacidad |

## 11. Siguiente paso recomendado

No planear épicas todavía. Primero cerrar las decisiones de la sección 8, en especial la 1
(automatización) y la 3 (cobertura de casos), porque determinan qué se construye y en qué
orden. Con ellas resueltas, el siguiente artefacto es el resumen de producto
(`bmad-product-brief`) de la v2 y después el PRD.
