# Revisión de calidad del PRD — Cuadra v2

Contexto: guía interna para un equipo pequeño. Los marcadores [SUPUESTO] y la sección 9 se tratan como intencionales y no se señalan como defectos.

## Veredicto general
El PRD es sólido para su propósito: tiene tesis clara ("un mes en horas, sin falsos positivos"), recorridos con protagonista, requisitos con consecuencias verificables y fases con puertas de salida. El riesgo principal está en la evidencia que decide la etapa 2 (SM-C1 y SM-2 se miden de forma que puede sesgarse) y en una contradicción entre el recorrido principal (UJ-1) y la separación de funciones activa por defecto (FR-22). Los requisitos de F8 y varias frases de UJ/FR son demasiado vagos para derivar historias sin reinterpretar.

## Decision-readiness — adequate
Las decisiones están enunciadas como decisiones (Cuadra no cierra casos, la vista previa es obligatoria hasta que el dueño la levante, falla cerrada en FR-22) y la sección 7 explica el orden de fases con razones. Las preguntas abiertas son genuinas. Falta nombrar el costo de algunas decisiones: la separación de funciones frena precisamente el flujo que la meta quiere acelerar y el PRD no lo reconoce.

### Findings
- **high** Contradicción entre UJ-1 y FR-22 (§2.3 UJ-1, §4.3 FR-22) — Marisol, contadora, sube el PDF y los CFDI y luego "confirma el lote". Con la separación de funciones activa por defecto y fallando cerrada, quien subió la carga no puede confirmar sus conciliaciones. El recorrido central de la meta es inviable con la configuración por defecto, salvo que la empresa tenga a otra persona que confirme (no se dice) o el dueño la desactive (lo que FR-24 marca como anomalía). *Fix:* decidir explícitamente: UJ-1 incluye un segundo actor que confirma, o la regla por defecto se redefine (p. ej. por carga, no por persona), y ajustar SM-1 en consecuencia.
- **medium** Costo de la separación de funciones no reconocido en SM-1 (§8) — El objetivo de ≤ 4 h por empresa-mes no dice si cuenta la espera de un segundo usuario. *Fix:* definir qué entra en el cronómetro.

## Substance over theater — strong
No hay teatro de personas (tres UJ, cada uno conduce requisitos y matices de falla reales), ni de innovación. La visión es específica de Cuadra. Los requisitos transversales de §5 son en su mayoría concretos (`NUMERIC`, `company_id`, RLS en la base). Única zona de furniture: la F8 y "Rendimiento".

### Findings
- **low** Rendimiento sin umbral (§5, §2.3 UJ-1 "En segundos") — "cientos de movimientos aparecen procesados en segundos" no es verificable. *Fix:* fijar un valor (p. ej. p95 ≤ 10 s para 500 movimientos) o aceptar que es una intención y retirarlo de los criterios.

## Strategic coherence — adequate
La tesis es coherente: conciliar rápido sin falsos positivos, y medir antes de automatizar. Las fases siguen esa lógica y las contra-métricas están nombradas (SM-C1, SM-C2), lo cual es poco común. El punto débil es que la medición que habilita la etapa 2 puede estar sesgada por el propio diseño del lote.

### Findings
- **high** SM-C1 sesgable por confirmación sin revisión (§4.3 FR-18/19, §4.5 FR-35, §8 SM-C1) — Las propuestas de la regla 1 vienen premarcadas y se confirman en lote con un clic. Si la persona confirma sin mirar, la tasa de desacuerdo baja artificialmente y "habría cerrado sola" parece seguro sin serlo. FR-35 solo cuenta desacuerdo si la persona actúa. Esto choca con la regla "un falso positivo es peor que no conciliar". *Fix:* añadir una medida independiente de la aceptación (muestreo de verdad terreno: auditar a mano una muestra de confirmaciones de regla 1 por empresa), o registrar tiempo/ritmo de revisión como señal de rubber-stamping.
- **high** SM-2 sin mecanismo de medición creíble (§8 SM-2) — "movimientos con propuesta correcta, de cualquier regla ≥ 80%" se mide "con el modo sombra y las respuestas de las personas", pero el modo sombra solo registra la regla 1 (FR-34). No hay definición de "correcta" para reglas 2 y 3 ni denominador (¿todos los movimientos o solo abonos?). La puerta de la fase 3 lo llama "Cobertura ≥ 80%", un nombre distinto sin definición. *Fix:* definir cobertura y precisión por separado, el denominador y la fuente de datos; unificar el nombre en §7 y §8.
- **medium** Evidencia exigida vs. calendario (§7, SM-C1) — 1,000 propuestas de regla 1 en ≥ 3 empresas supone volumen y clientes que la fase 2a (una empresa, un mes) no garantiza; no hay horizonte temporal. *Fix:* estimar si el volumen es alcanzable y en cuánto tiempo, o aceptar que la etapa 2 es una decisión posterior sin fecha.
- **medium** SM-C2 no medible tal cual (§8) — "cierres incorrectos sin detectar: cero" es indetectable por definición. *Fix:* reformular como proceso (muestreo periódico de revisión, tasa de reaperturas por error) con umbral.

## Done-ness clarity — thin
Hay buenas consecuencias verificables (FR-2, FR-6, FR-18, FR-32/33, FR-43), pero muchos FR son una frase sin condición comprobable, y F8 es casi todo adjetivos.

### Findings
- **medium** F8 sin umbrales (§4.8 FR-56 a FR-62) — "despliegue repetible", "límite de peticiones", "correo configurable", "prueba real con la IA" no dicen qué cuenta como hecho (qué límite, qué configurable, qué resultado aprueba la prueba). Es el bloque que abre la fase 1. *Fix:* una consecuencia comprobable por FR (p. ej. "máx. N intentos de login por IP por minuto; el N+1 devuelve 429").
- **medium** FR sin criterio de aceptación (FR-8, FR-10, FR-16, FR-17, FR-24, FR-54) — "nivel de confianza" no se define (¿escala, umbrales por regla?) aunque ordena toda la bandeja; "de forma visible" (FR-24) y "el auditor no ve botones" no dicen dónde ni cómo se comprueba. *Fix:* definir los valores de confianza (o su mapeo regla→nivel) y la ubicación/forma del aviso.
- **medium** Sin FR para la IA que "sugiere" (§4.2 descripción, FR-15, FR-62, §5 Privacidad) — La IA aparece en la descripción, en FR-15 y en privacidad, pero ningún requisito dice cuándo se invoca, qué devuelve ni cómo se presenta como sugerencia en los casos ambiguos. *Fix:* un FR de sugerencia con IA (disparador, salida, etiqueta en la bandeja, lista cerrada de campos).
- **medium** Roles sin matriz de acciones (§4.7 FR-53, FR-25, FR-30) — La tabla cubre secciones, no acciones. No se dice si el `revisor` confirma, rechaza o descarta (UJ-3 lo muestra rechazando; FR-30 solo le niega reabrir). *Fix:* añadir una matriz rol × acción (confirmar, rechazar, descartar, reabrir, cargar, ver).
- **low** Tolerancia sin FR ni glosario (§4.7 tabla, UJ-2, Q3 de §9) — Aparece en el menú y en una pregunta abierta, pero no hay definición ni requisito (se asume heredada de la v1). *Fix:* término en el glosario y una nota de "heredado de la v1".

## Scope honesty — strong
§6 lista de verdad lo que no entra (parcialidades, otras monedas, PDF escaneados, e.firma), con razones de fase en §7. Los supuestos están indexados y las preguntas abiertas tienen densidad razonable para un borrador interno. Las marcas "(fase 3)" en FR-36/37 hacen explícito el diferimiento.

### Findings
- **low** Brownfield sin delimitar (§0, FR-4, FR-14, FR-21) — Se dice que `CUADRA.md` es la fuente de lo que la v1 hace, pero los FR no distinguen nuevo de heredado (solo FR-4 cita CU-09). Se corre el riesgo de reconstruir lo ya hecho. *Fix:* marcar cada FR como [NUEVO] o [HEREDADO v1].

## Downstream usability — adequate
Glosario presente y mayormente respetado; FR-1 a FR-62 contiguos, cada UJ con protagonista y contexto; SM→FR trazables. Las secciones se entienden aisladas.

### Findings
- **medium** El dueño de Cuadra no tiene recorrido (§2.1, §4.5, §4.6) — Tiene un trabajo por hacer, pero ningún UJ, y sostiene FR-3, FR-23, FR-37, FR-39. La pregunta 1 (¿pantalla o comando?) deja a UX y arquitectura sin base. Aceptable en un PRD interno, pero afecta lo que viene. *Fix:* un UJ corto del dueño o una nota de que la interfaz se decide aguas abajo.
- **low** El auditor no tiene persona ni trabajo por hacer (§2.1, FR-25, FR-54) — Existe como rol y FR, pero no en §2.1. *Fix:* una línea en "Trabajos por hacer" o fusionar el rol con revisor si la diferencia no se justifica.
- **low** UJ-3 vs FR-52 (§2.3 UJ-3) — Pedro "no ve" las cargas rechazadas, pero FR-51/52 le dan acceso a la bitácora, donde cada carga queda con su resultado. *Fix:* aclarar si la bitácora muestra cargas rechazadas al revisor.

## Shape fit — adequate
Producto B2B multirrol con auditoría; los tres UJ son proporcionados y la trazabilidad es la adecuada para una cadena UX → arquitectura → historias. No está sobre-formalizado.

## Mechanical notes
- IDs: FR-1 a FR-62 contiguos y sin duplicados; SM-1, SM-2, SM-C1, SM-C2 y UJ-1 a UJ-3 resuelven. Los rangos "Valida FR-x a FR-y" son coherentes.
- Índice de supuestos: todo supuesto inline aparece en el índice. El último ítem (un despacho lleva varias empresas con un solo acceso, D-05) está en el índice pero no tiene marca inline; añadirla en glosario "Usuario" o en UJ-1.
- Deriva terminológica: "cobertura" (§7 fase 3) vs "propuesta correcta" (SM-2); "dueño de Cuadra" y "dueño" alternan; "empresa-mes" aparece solo en SM-1; "tolerancia" sin entrada en el glosario.
- Duplicidad: la pregunta 3 de §9 y el supuesto de FR-11 tratan lo mismo (consistente, solo asegurarse de cerrarlas juntas).
- Secciones requeridas para el nivel de rigor (interno): presentes.
