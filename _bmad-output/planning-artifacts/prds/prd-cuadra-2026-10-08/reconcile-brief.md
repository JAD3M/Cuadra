# Conciliación: brief.md + addendum.md contra prd.md

Entrada: `briefs/brief-cuadra-2026-10-08/brief.md` y `addendum.md`.
Se excluyen las refinaciones aceptadas (separación de funciones configurable, rol auditor, vista previa por banco, reapertura de lote).

## Lo que el PRD omite o contradice

### G1. Condiciones de la etapa 2 desaparecieron (addendum §2)
El addendum fija cuándo se puede cerrar solo: solo referencia y monto exactos con candidata única, sin tolerancia ni ambigüedad; reversible; lista de "cerrados automáticamente" revisada por muestreo; activación por empresa; pagos con varias facturas nunca se cierran solos. El PRD conserva solo "nunca se cierra sola" (FR-11), el umbral SM-C1 y la pregunta abierta 8 ("¿quién activa?"). Faltan reversibilidad, muestreo y activación por empresa como condiciones. Tampoco queda registrado que `ck_conciliaciones_confirmada_requiere_persona` se cambia en la etapa 2 y no antes. Riesgo: la etapa 2 se diseñaría sin sus guardas.

### G2. Cambios al modelo de la v1 sin requisito (addendum §3)
- El índice único parcial (una confirmada por movimiento) bloquea FR-11. Debe permitir varias confirmadas por movimiento y una sola por CFDI. Es cambio de la etapa 1 y el PRD no lo menciona (puede ser decisión de arquitectura, pero el límite "una confirmada por CFDI" es regla de producto). El addendum marca "por verificar" la fuente (`CUADRA.md` ~442-445, no la migración).
- `companies`, `users` y `user_company_roles` están fuera de RLS. Con altas desde la app deben tocarse por una vía con permisos propios y con pruebas de que un usuario no lista ni se une a empresas ajenas. El PRD solo dice "aislamiento por empresa" (sección 5) y no cubre este caso. Falta un FR o criterio de aceptación.
- "La tolerancia de monto solo aplica en MXN" no aparece.

### G3. Regla de robo de RFC y su razón (addendum §4)
Se perdió la regla "un RFC solo bloquea a otros cuando está verificado; un reclamo sin verificar no impide que el dueño real se registre", y la razón (el daño es bloquear al dueño legítimo, no filtrar datos). El PRD tiene FR-49 (RFC único) y la aprobación manual implícita en FR-39, pero sin la regla. UJ-2 dice "un RFC ya existente lo resuelve el dueño" sin criterio. No contradice, pero FR-49 sin matiz de "verificado" admite leer que un RFC dado de alta bloquea siempre.

### G4. El modo sombra no mide lo que el brief y las preguntas piden
- Pregunta abierta 7 del PRD y riesgo 1 del brief: el modo sombra debe medir qué fracción cae en parcialidades, comisiones y PPD. FR-34 a FR-38 solo registran propuestas de la regla 1. Nada registra los casos excluidos.
- SM-2 (≥ 80% de propuestas correctas de cualquier regla) dice medirse "con el modo sombra", pero este solo cubre la regla 1. La fase 3 promete "cobertura ≥ 80% medida" y no hay FR de una pantalla o consulta de cobertura.
- El brief mide la tasa de rechazo "por banco" como condición de la etapa 2. FR-37 lo da al dueño, pero SM-C1 (1,000 propuestas en 3 empresas) no exige separar por banco.

### G5. Hallazgos de la v1 sin requisito (addendum §1)
- La moneda del movimiento nunca se asigna al importar (`default 'MXN'`). FR-13 cubre solo el CFDI. Un movimiento en otra moneda o sin moneda real queda sin tratamiento.
- No hay pruebas e2e entre los mínimos de producción (brief: "no hay ... pruebas e2e"). F8 (FR-56 a FR-62) no las incluye.

### G6. Ideas cualitativas que la estructura de FR dejó fuera
- Postura del brief: "no hay una ventaja técnica defendible; lo distingue la disciplina, y la v2 la convierte en medición en lugar de promesa". El PRD conserva la frase de visión pero pierde el argumento de por qué las métricas contra-métricas existen.
- Razón de la cobertura: "si solo se automatiza ~50%, el contador sigue a mano y la meta de horas no se cumple". Sustenta el umbral de SM-2 y no está en el PRD.
- Riesgo 3 del brief (tasa de error real desconocida, datos sintéticos) y riesgo 5 (texto bancario enviado a un tercero): el PRD los cubre solo con FR-62 y la línea de Privacidad. No hay registro explícito como riesgo.
- Riesgo 1 (¿alcanza la cobertura para llegar a "horas" con exclusiones?) pasa a pregunta abierta 7, pero sin la consecuencia de decisión (¿entra alguna exclusión a la v2?).

## Verificado como cubierto (sin hueco)
Cuadre de saldos, vista previa, PDF escaneado (FR-7), solo MXN, multi-empresa por despacho (D-05, en supuestos), alta controlada por el dueño, invitaciones y recuperación, bitácora inmutable, menú por rol, matriz de permisos, requisitos de producción, muestras de PDF como prerrequisito, tipo de cuenta (pregunta 2), cargos/egresos/notas de crédito fuera.
