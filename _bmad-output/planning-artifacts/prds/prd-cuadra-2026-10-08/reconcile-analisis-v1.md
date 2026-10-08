# Reconciliación: analisis-v1.md contra el PRD de Cuadra v2

Entrada: `_bmad-output/planning-artifacts/analisis-v1.md` (secciones 6, 7, 8, 9, 10).
PRD: `prds/prd-cuadra-2026-10-08/prd.md` (borrador, 2026-10-08).

## 1. Cubierto (sin acción)

| Análisis v1 | PRD |
|---|---|
| 6.2 `cargar` nunca se escribe en la bitácora | FR-52 |
| 6.3 menú sin filtrar por rol | FR-53, FR-54 |
| 6.1 moneda: CFDI en otra moneda sin explicación | FR-5, FR-13 ("moneda no soportada") |
| 7 CORS, rate limiting | FR-57, FR-58 |
| 7 sesión frágil, logout | FR-59 (parcial, ver G6) |
| 7 despliegue repetible, migraciones, secretos | FR-56, FR-60 (genéricos) |
| 7 prueba real con el LLM, texto bancario a un tercero | FR-62, sección 5 Privacidad |
| 7 solo abonos, egresos, notas de crédito | No objetivos (SUPUESTO) |
| 8.1 modo sombra, etapa 2 diferida | F5, FR-34 a FR-38, SM-C1, No objetivos |
| 8.3 varias facturas por pago, solo subconjunto único | FR-11, FR-12 |
| 8.4 PDF, cuadre, vista previa, tres bancos | FR-1 a FR-3, F1, sección 7 |
| 8.5 invitaciones, recuperación, último admin | FR-39 a FR-50 |

## 2. Lo que el PRD omite en silencio (ni requisito, ni no objetivo, ni pregunta abierta)

### G1. Moneda del movimiento bancario (hallazgo 6.1, causa raíz) [ALTA]
El análisis dice que `movimientos.moneda` tiene `default 'MXN'` y ningún lector la fija. El PRD
solo trata la moneda del CFDI (FR-5, FR-13). Con "solo MXN" decidido, un estado de cuenta en USD
se importaría como MXN sin aviso, lo que puede producir falsos positivos (regla del proyecto:
peor que no conciliar). Falta un requisito: los lectores PDF/CSV fijan la moneda explícitamente
y rechazan (o marcan) estados de cuenta que no sean MXN. Tampoco se menciona que la tolerancia
solo aplica en MXN.

### G2. Estados `cancelada` y `descartado` sin transición (sección 9) [ALTA]
- `cancelada` nunca se asigna en el código. El PRD no dice qué pasa con un CFDI cancelado en el
  SAT: queda `abierta` y puede proponerse (falso positivo). Los No objetivos solo dicen "no
  valida el timbre del SAT"; eso no equivale a decidir qué hacer con cancelados.
- FR-21 (descartar) y FR-27 (reabrir) suponen un estado `descartado` y transiciones que el
  análisis marca como "posiblemente" inexistentes (no verificado). El PRD no lo declara como
  supuesto ni como dependencia.
- El estado `parcialidades` del CFDI existe en la v1 y el PRD no lo menciona (solo los No
  objetivos nombran las parcialidades como caso).
- PPD con complemento de pago (sección 7) aparece solo en la pregunta abierta 7, no en los
  No objetivos.

### G3. Pruebas: e2e y deriva (secciones 7, 9, 10) [MEDIA]
- Sin e2e contra la API real (riesgo Medio en 10). El PRD no tiene requisito, métrica ni no
  objetivo de calidad. Tampoco la subida real de archivos que CUADRA.md admite sin probar.
  FR-22 pide pruebas en dos modos, pero solo para la separación de funciones.
- Pruebas de deriva: los valores del dominio se copian a mano del backend. La v2 agrega el rol
  `auditor`, nuevos estados, acciones de bitácora y motivos; cada uno exige sincronizar el
  frontend. El PRD no lo menciona. Las pruebas de deriva que exigen el repo completo siguen
  siendo una trampa para quien trabaje solo en `frontend/`.

### G4. Seguridad restante, observabilidad y escala (sección 7) [MEDIA]
- helmet / cabeceras de seguridad: ausente. FR-58 cubre rate limiting pero no el bloqueo de
  cuenta (el análisis dice que se delega a un proxy inexistente): no hay requisito de bloqueo
  tras intentos fallidos.
- FR-59 pide botón de cerrar sesión, pero no logout en servidor ni revocación; el análisis lo
  nombra explícitamente.
- Observabilidad (solo `/health`, sin métricas, trazas ni correlación): sin requisito ni no
  objetivo.
- Escala: el motor carga en memoria todos los movimientos y CFDI abiertos, los archivos viven
  como `Buffer` y la cola es un solo worker en la API. El PRD solo declara "cientos de
  movimientos en segundos" (SUPUESTO). No hay límite de tamaño de empresa, ni no objetivo de
  escala.
- FR-56 no menciona imagen de producción del frontend, proxy que reescriba `/api`, frontend
  fuera de `docker-compose.yml` (D8), ni puertos publicados.

### G5. Escritura sobre tablas fuera de RLS (8.5 y sección 5) [ALTA]
La decisión 5 exige: (a) una vía de escritura con permisos propios para `companies`, `users` y
`user_company_roles` (hoy `cuadra_app` no puede crearlos); (b) pruebas que demuestren que un
usuario no puede listar ni unirse a empresas ajenas. El PRD (F6) no lo recoge: FR-47 solo limita
la lista de usuarios a su empresa y la sección 5 dice que el aislamiento se impone en la base
de datos, justo lo que no ocurre con esas tablas (matiz de la sección 5 del análisis). Falta
requisito transversal y criterio de prueba.

### G6. Correcciones documentales D2 a D10 y deuda menor (secciones 4 y 9) [BAJA]
CUADRA.md sigue describiendo estados, tablas, acciones y variables que ya no coinciden. El PRD
dice que CUADRA.md es la fuente de verdad de la v1 pero no pide corregirlo. La deuda menor
(código muerto `MarcadorPendiente`, comentarios obsoletos, `TolerPage`, archivos de 377 a 419
líneas, `dentroDeTolerancia` en cliente) no aparece; aceptable como no objetivo explícito. El
principio "ninguna decisión en el navegador" sí cubre el riesgo de `dentroDeTolerancia`.

## 3. Contradicciones o desvíos frente a la sección 8

| # | Decisión del análisis | PRD | Gravedad |
|---|---|---|---|
| C1 | 8.5 y 8.6: tres roles (`admin`, `contador`, `revisor`); la bitácora la ven esos tres | Glosario, FR-25, FR-41, FR-51: cuatro roles, con `auditor` nuevo. Implica cambiar el CHECK de roles y los tipos del frontend. Origen de `auditor` no consta en la sección 8 | Alta |
| C2 | 8.5: "la separación de funciones se mantiene" | FR-23 permite al dueño desactivarla por empresa. Es una relajación de una regla v1 no decidida en la sección 8 | Media |
| C3 | 8.6: matriz de permisos del resto de pantallas "pendiente" | FR-53 y FR-9 la fijan como si estuviera decidida (p. ej. contador solo lectura en Tolerancia; revisor sin Cargas) y no está marcada [SUPUESTO] ni en el índice de la sección 10. Debe contrastarse con `ROLES_QUE_CARGAN` y `ROLES_QUE_EDITAN_TOLERANCIA` | Media |
| C4 | 8.5: "no se puede quitar al último admin" es regla decidida | FR-46 lo marca [SUPUESTO] (UJ-2 también). Debería ser decisión | Baja |
| C5 | 8.5: el dueño "aprueba" la empresa; el admin invita | FR-39: el dueño "crea" la empresa e invita al primer admin. Compatible, pero el PRD no define cómo se autentica el dueño (pregunta abierta 1 solo cubre pantalla o comando) | Baja |
| C6 | 8.5: "un RFC solo bloquea a otros cuando está verificado" | FR-49 declara RFC único sin distinguir verificado. Hoy es coherente porque solo el dueño crea empresas con RFC verificado, pero no se explicita | Baja |
| C7 | 8.5: pendiente "si un despacho llevará varias empresas con un solo acceso" | Sección 10 lo trata como supuesto (D-05) y UJ-1 lo da por hecho; debería ser pregunta abierta | Baja |
| C8 | 8.3: modelo de la v1 bloquea varias confirmadas por movimiento (índice único parcial; "confirmar en el diseño") | FR-11 lo pide sin señalar el cambio de modelo ni dejar el chequeo como pregunta o riesgo. Lo mismo para FR-26 a FR-33 (reapertura vs índices únicos y `ck_conciliaciones_confirmada_requiere_persona`) | Media |
| C9 | 8.4: perfiles BBVA/Banorte/Santander "reemplazan" a los dos perfiles sintéticos; Excel secundario | FR-4 conserva el CSV como "comportamiento de la v1" (perfiles sintéticos); Excel no se menciona ni se excluye | Baja |

Consistentes sin hallazgo: 8.1 (FR-15, FR-18, FR-34 a FR-38; etapa 2 diferida con pregunta
abierta 8), 8.2 (solo MXN, motivo visible en bandeja), 8.3 (subconjunto único, nunca cierre
automático), 8.4 (cuadre, vista previa, PDF escaneado fuera), 8.6 (bitácora inmutable, incluso
para el admin).

## 4. Acciones sugeridas para el PRD

1. Agregar FR de moneda del movimiento bancario (G1) y declarar tolerancia solo MXN.
2. Declarar tratamiento de CFDI cancelados y verificar el estado `descartado` (G2); listar PPD
   y `parcialidades` en No objetivos.
3. Agregar requisito de la vía de escritura y pruebas de aislamiento para `companies`, `users` y
   `user_company_roles` (G5).
4. Resolver con el dueño el rol `auditor`, la desactivación de la separación de funciones y la
   matriz FR-53 (C1 a C3), o marcarlos como [SUPUESTO] en la sección 10.
5. Añadir en F8 o en No objetivos: e2e contra API real, pruebas de deriva, helmet, bloqueo de
   cuenta, logout en servidor, observabilidad y escala (G3, G4).
6. Anotar el cambio de índices/CHECK de conciliaciones como riesgo de diseño (C8).
