# Adenda del resumen de producto de Cuadra v2

Detalle que respalda al resumen y que no cabe en sus dos páginas. Fuente de los hallazgos:
`_bmad-output/planning-artifacts/analisis-v1.md`.

## 1. Hallazgos de la v1 que alimentan la v2

Faltantes:
- La moneda del movimiento nunca se asigna al importar (`default 'MXN'`).
- La acción `cargar` existe en la bitácora, pero ninguna carga la escribe.
- El menú muestra todo a todos los roles; el servidor responde 403.
- No hay imagen de producción, CORS, limitación de peticiones, refresh de sesión ni pruebas e2e.

Riesgo abierto:
- La prueba real contra el proveedor de IA no se ha hecho, porque se envía texto bancario a un
  tercero.

## 2. Automatización: alternativas consideradas

**Decisión:** B con modo sombra primero; A por empresa cuando los datos lo respalden.
**Por qué:** el riesgo real no es el cierre automático, sino el error que nadie ve hasta que un
cliente se queja. El modo sombra mide la tasa real de rechazo (la v1 solo tiene datos sintéticos)
antes de asumir ese riesgo.
**Condiciones de la etapa 2 (cierre automático):** solo referencia y monto exactos con candidata
única, sin tolerancia ni ambigüedad; reversible; lista de "cerrados automáticamente" revisada por
muestreo; activación por empresa; los pagos que cubren varias facturas nunca se cierran solos.

| | A. Cierre automático de la evidencia más fuerte | B. Confirmación en lote por una persona |
|---|---|---|
| Qué hace | El sistema cierra solo los pares de máxima certeza, con actor "sistema", reversible y auditado | El sistema agrupa las propuestas fuertes y una persona las confirma de golpe |
| Cumple la promesa original del producto (conciliación automática con revisión humana en los casos dudosos) | Por completo | Casi: ahorra tiempo, pero no la decisión |
| Riesgo de falso positivo | Mayor | Menor: siempre hay un responsable |
| Costo | Cambia la restricción de BD, la auditoría y el modelo de actores | Una pantalla y un endpoint nuevos |

## 3. Restricciones del modelo de la v1 que la v2 debe cambiar

- `ck_conciliaciones_confirmada_requiere_persona`: hoy impide cualquier cierre sin intervención
  humana. Se cambia en la etapa 2, no en la etapa 1.
- Índice único parcial de una sola conciliación confirmada **por movimiento**: impide que un pago
  cubra varias facturas. Debe permitir varias confirmadas por movimiento y conservar una sola por
  CFDI. Se cambia en la etapa 1. *Por verificar:* la fuente es `CUADRA.md` (~líneas 442-445), no la
  migración.
- La tolerancia de monto solo aplica en MXN.
- `companies`, `users` y `user_company_roles` están fuera de RLS por diseño (`AislamientoRls.ts`).
  Con altas desde la app, deben tocarse solo por una vía con permisos propios y con pruebas de que
  un usuario no puede listar ni unirse a empresas ajenas.

## 4. Robo de RFC: opciones evaluadas

**Decisión:** aprobación manual al inicio.
**Regla que aplica siempre:** un RFC solo bloquea a otros cuando está verificado; un reclamo sin
verificar no impide que el dueño real se registre.
**Por qué:** el daño del robo de RFC es bloquear al dueño legítimo, no filtrar datos, porque los
datos se separan por `company_id` y no por RFC.

| Opción | Seguridad | Costo |
|---|---|---|
| Alta con aprobación manual del dueño de Cuadra | Alta mientras haya pocos usuarios | No requiere código; no escala |
| Verificar con la e.firma (el `.cer` trae el RFC; firmar un reto prueba el control de la llave) | La más alta; es automática | Complejo y sensible. La firma debe hacerse en el navegador para que la llave privada no salga de ahí. Los detalles se confirman en el diseño |
| Constancia de situación fiscal | Media | Media |
| El primer CFDI cargado coincide con el RFC | Baja: los clientes y proveedores también tienen esos CFDI | Baja |

## 5. Entradas bancarias

- PDF descargado del portal: reglas por banco; cuadre de saldos (saldo inicial + abonos − cargos
  = saldo final; si no cuadra, la carga se rechaza antes del motor); vista previa humana al inicio.
- PDF escaneado o foto: necesita OCR o IA, con más error y costo. Mientras tanto se puede pedir al
  cliente el PDF del portal.
- `CUADRA.md` (decisión D-02) dejó el PDF como "la primera deuda a pagar en la continuidad".
- Dependencia: estados de cuenta PDF reales y anonimizados de BBVA, Banorte y Santander. Sin ellos
  no se pueden construir ni probar los lectores.
- Por averiguar: si el diseño cambia según el tipo de cuenta.
