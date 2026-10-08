---
title: "Cuadra v2 — Resumen de producto"
status: final
created: 2026-10-08
updated: 2026-10-08
---

# Resumen de producto: Cuadra v2

Guía interna para el equipo. Las marcas **[SUPUESTO]** señalan lo que se infirió y debe
confirmarse. El detalle de las alternativas descartadas está en `addendum.md`.

## Resumen ejecutivo

Cuadra concilia las facturas CFDI con los movimientos del estado de cuenta bancario. La v1
demostró que el motor de reglas, la bandeja de revisión y la bitácora funcionan, pero con datos
sintéticos y con una persona confirmando cada caso.

La v2 lleva ese motor a uso real. Lee los estados de cuenta en PDF de BBVA, Banorte y Santander
y resuelve el pago que cubre varias facturas. Permite que cada empresa dé de alta a sus usuarios
y confirma en lote lo que el sistema ya propone con evidencia fuerte.

La meta es una sola: **que un contador concilie un mes en horas, no en días.**

## El problema

El CFDI dice que se debe cobrar algo; el estado de cuenta dice que entró dinero; nada los une.
Cada mes alguien en contabilidad empata a mano las facturas con los movimientos, línea por línea.
Con cientos de movimientos son días de trabajo, y los errores no dejan rastro: un pago mal
empatado se descubre meses después, cuando un cliente reclama que ya pagó.

El requisito silencioso no cambia: **un falso positivo es peor que no conciliar.** Marcar como
pagada una factura que no se pagó rompe la contabilidad de forma difícil de detectar. Por eso el
motor decide, la IA solo sugiere, y el sistema prefiere no conciliar antes que equivocarse. No hay
una ventaja técnica defendible: lo que distingue a Cuadra es esa disciplina, y la v2 la convierte
en medición (tasa de rechazo por banco) en lugar de promesa.

## Quién lo usa

- **Contador** (de empresa o de despacho): carga archivos, revisa y confirma. Un despacho lleva
  varias empresas con un solo acceso (diseño de la v1, D-05) **[SUPUESTO: sigue vigente]**.
- **Revisor:** revisa y confirma casos; no carga archivos.
- **Administrador de empresa** (rol `admin`): gestiona usuarios y la tolerancia de monto.
- **Dueño de Cuadra:** aprueba las empresas nuevas.

## La solución

- **Entradas reales.** PDF descargado del portal de BBVA, Banorte y Santander, con cuadre de
  saldos (si saldo inicial + abonos − cargos no da el saldo final, la carga se rechaza) y vista
  previa.
- **Pago que cubre varias facturas.** Es el caso más frecuente. El motor propone el subconjunto de
  facturas solo cuando es único; si hay varias combinaciones posibles, el caso va a la bandeja sin
  propuesta. Una persona siempre confirma estos casos.
- **Confirmación en lote con modo sombra.** El sistema agrupa las propuestas fuertes y una persona
  las confirma de golpe. Además marca qué casos *cerraría solo* y mide cuántos rechaza la persona.
  Con esa tasa real se decide, empresa por empresa, si se activa el cierre automático (etapa 2).
- **Altas controladas.** El dueño de Cuadra aprueba cada empresa; el administrador de la empresa
  invita a sus usuarios con rol `admin`, `contador` o `revisor`.
- **Confianza.** Los tres roles ven la bitácora; nadie puede modificarla ni borrarla desde la
  aplicación. El menú muestra a cada rol solo lo que puede usar.

## Cómo sabremos que funciona

| Señal | Meta |
|---|---|
| Tiempo para conciliar un mes de la empresa (cientos de movimientos) | Horas, no días. **[SUPUESTO]** objetivo: ≤ 4 horas por empresa-mes (confirmado como realista) |
| Movimientos que llegan con propuesta correcta | **[SUPUESTO]** ≥ 80%, por validar con el modo sombra |
| Cierres incorrectos sin detectar | Cero; toda decisión es rastreable en la bitácora |
| Tasa de rechazo de lo que el sistema cerraría solo | Medida por banco; es la condición para activar la etapa 2 |

Si solo se automatiza cerca del 50% de los movimientos, el contador sigue haciendo el resto a
mano y la meta de horas no se cumple. Por eso la cobertura de propuestas correctas debe ser alta.

## Alcance de la v2

**Dentro del alcance**
- Todo lo descrito en *La solución*.
- Solo MXN: un CFDI en otra moneda muestra el motivo "fuera de alcance" en la bandeja.
- Envío de correos y recuperación de contraseña, necesarios para las invitaciones.
- Requisitos mínimos para operar en producción: despliegue, CORS, límite de peticiones y una sesión
  que no se pierda al recargar. **[SUPUESTO: no se decidió explícitamente, pero sin esto no hay
  uso real]**

**Fuera del alcance (por ahora)**
- Cierre automático (etapa 2), hasta que el modo sombra lo justifique.
- Parcialidades (varios pagos para una factura) y comisiones bancarias.
- Otras monedas, PDF escaneado, registro abierto y verificación del RFC con e.firma.
- Cargos, egresos y notas de crédito **[SUPUESTO: siguen fuera]**.

## Riesgos y preguntas abiertas

1. **Cobertura contra "horas".** Con parcialidades, comisiones y pagos en parcialidades o diferidos
   (PPD) fuera del alcance, ¿alcanza la cobertura para llegar a horas? El modo sombra debe medir
   qué fracción de los movimientos cae en cada caso excluido, para decidir si alguno entra en la v2.
2. **Muestras de PDF.** Se necesitan estados de cuenta reales y anonimizados de los tres bancos.
   Sin ellos no se pueden construir ni validar los lectores. Falta saber si el diseño cambia según
   el tipo de cuenta.
3. **Tasa de error desconocida.** Los datos de la v1 son sintéticos; el riesgo real solo se
   conocerá al medirlo.
4. **Permisos.** Falta la matriz del resto de pantallas (bandeja, caso, cargas, tolerancia).
5. **IA.** La prueba real contra el proveedor sigue sin hacerse y se envía texto bancario a un
   tercero.
