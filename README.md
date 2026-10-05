# Cuadra

Conciliación automática de facturas CFDI contra movimientos bancarios, con
revisión humana en los casos dudosos.

Subes las facturas (XML) y el estado de cuenta (CSV). Un motor de reglas
propone qué pago corresponde a qué factura y explica por qué. Lo que queda
ambiguo se manda a revisión, y **solo una persona cierra un caso**: ni el motor
ni la IA confirman nada. Un falso positivo es peor que no conciliar.

El contexto completo (problema, arquitectura, decisiones e historias) está en
[`CUADRA.md`](CUADRA.md).

## Requisitos

- Docker con Compose. Nada más: Node, Postgres y Redis corren en contenedores.

## De cero a la demo (menos de 5 minutos)

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api npm run migration:run
docker compose exec api npm run seed
docker compose exec api npm run demo
```

El último comando carga 40 facturas y 50 movimientos bancarios sintéticos de
una ferretería y un conjunto chico de una segunda empresa, recorre el producto
por HTTP como lo haría una persona y verifica cada paso contra lo esperado. Si
algo no coincide, termina con código 1 y te dice qué esperaba, qué obtuvo y qué
revisar. Tarda unos 15 segundos.

También funciona desde tu máquina con Node 22 o superior (`npm install` y
`npm run demo`); por omisión apunta a `http://localhost:3000` (`DEMO_BASE_URL`
lo cambia).

### Salida esperada

```text
Cuadra demo contra http://localhost:3000

[1/9] API disponible ... OK (http://localhost:3000)
[2/9] Luis carga 40 CFDI de Ferretería ... OK (40 CFDI procesados)
[3/9] Luis carga el estado de cuenta 1 (45 movimientos) ... OK (45 movimientos procesados)
[4/9] El motor propone y la IA simulada sugiere (fase 1) ... OK (26 sugerencias (4 de IA simulada), 13 sin match, 0 conciliados)
[5/9] Ana fija tolerancia 5.00 y Luis carga el estado de cuenta 2 ... OK (con tolerancia 5.00 el pago de 1155.00 ahora se propone; 27 sugerencias, 15 sin match)
[6/9] Confirmación: Luis (quien subió) no puede, Jorge sí ... OK (Luis: 403; Jorge: 200; historial: crear > confirmar)
[7/9] Jorge rechaza un pago parcial y se revisa el historial ... OK (rechazada; historial: crear > rechazar; IA: crear (modelo simulado-demo, sin usuario))
[8/9] Resumen de Ferretería ... OK (42 movimientos abonados en la bandeja)

  Estado        Movimientos
  conciliado       1   (confirmado por una persona)
  sugerencia      25   (4 de IA simulada)
  sin_match       16

  Regla                              Movimientos
  llm_sugerencia                        4
  monto_candidato_ocupado               1
  monto_multiples_candidatos            1
  monto_unico                           7
  referencia_ambigua                    1
  referencia_cfdi_no_compatible         2
  referencia_monto_diferente            1
  referencia_monto_exacto              13
  sin_candidato_monto                  11

  AVISO: las sugerencias de IA son SIMULADAS (modelo simulado-demo); no se llamó a ningún modelo real.
  El motor de reglas decidió; nadie confirmó las propuestas de IA.

[9/9] Carmen carga Transportes y se verifica el aislamiento ... OK (Transportes: 3 sugerencias / 1 sin match / 0 conciliados (4 abonos en la bandeja); ajeno: 404/404; revisor sube CFDI: 403; Ferretería intacta)

Demo completa: todo coincide con lo esperado.
```

Por qué `conciliado` es 1 y no 26: el motor **nunca concilia solo**; propone. En
el paso 6 Jorge confirma una propuesta y en el paso 7 rechaza otra. Las demás
esperan a una persona.

## Qué contiene la demo

Todo es inventado; no hay datos de clientes reales en el repositorio
(RFC de prueba, nombres terminados en "(sintético)", sellos `SINTETICO`).

| Empresa | Facturas | Movimientos | Qué prueba |
|---|---|---|---|
| Ferretería del Bajío (`FDB190215QK4`) | 40 | 50 (45 + 5 en dos estados de cuenta) | Casos limpios y difíciles |
| Transportes Cuautla (`TCU170830R52`) | 4 | 5 | Aislamiento entre empresas |

Casos difíciles de Ferretería: referencia con distinto formato (`A-1001`,
`A1001`, `1001`), pago parcial, folios repetidos en dos series, varias facturas
con el mismo monto, una factura pagada dos veces, pago anterior a la emisión,
factura en dólares, factura PPD, pagos sin factura y cargos bancarios. Un pago
de 1155.00 contra una factura de 1160.00 solo se propone después de subir la
tolerancia de 5.00 (paso 5).

Los archivos viven en `demo/` (`demo/cfdi/*.xml` y `demo/estado-cuenta-*.csv`)
y salen de un generador determinista: mismo código, mismos bytes. Si cambias la
tabla de escenarios (`scripts/demo/escenarios.ts`), regenera con:

```bash
npm run demo:generar
```

Una prueba falla si lo commiteado difiere de lo que genera el código.

## Usuarios de la demo

La contraseña de todos es `cuadra-dev-2026` (solo desarrollo; la pone el seed).

| Persona | Correo | Empresa y rol |
|---|---|---|
| Ana Reyes | `ana.reyes@fdb.mx` | Ferretería: admin |
| Luis Mendoza | `luis.mendoza@fdb.mx` | Ferretería: contador (sube los archivos) |
| Jorge Tapia | `jorge.tapia@despacho.mx` | Ferretería: contador; Transportes: revisor |
| Carmen Olvera | `carmen.olvera@cuautla.mx` | Transportes: admin |

Quien sube un archivo no puede confirmar lo que salió de él (por eso en el
paso 6 Luis recibe 403 y Jorge sí puede). El runner solo se conecta a
`localhost`, `127.0.0.1` o `::1`, porque usa esa contraseña pública;
`DEMO_PERMITIR_REMOTO=1` desactiva la guarda bajo tu responsabilidad.

## La IA de la demo es simulada

Las cuatro sugerencias de IA de la demo **no vienen de un modelo real**. Las
produce un proveedor determinista (`LLM_PROVEEDOR=simulado`, modelo
`simulado-demo`) que no usa red ni llave. Se nota en todas partes: el motivo de
cada una empieza con `Sugerencia de IA: [SIMULADA — no es un modelo real]`, la
bitácora guarda el modelo `simulado-demo` y la API arranca con un aviso en el
log. Con `NODE_ENV=production` ese valor se **rechaza** al arrancar.

Para usar el modelo real (de pago): en `.env` pon `LLM_PROVEEDOR=anthropic` y
tu `ANTHROPIC_API_KEY`, y reinicia la api. Con el proveedor real la demo no
reproducirá las mismas cuatro sugerencias. La prueba de humo contra la API real
sigue pendiente (ver la bitácora en `docs/bitacora.md`).

## Volver a empezar

Correr `npm run demo` otra vez no duplica nada: detecta que los archivos ya
están cargados, lo dice y termina con código 0. Para repetirla desde cero hay
que borrar el volumen de la base:

```bash
docker compose down -v
docker compose up -d --build
docker compose exec api npm run migration:run
docker compose exec api npm run seed
docker compose exec api npm run demo
```

## Si algo falla

- **`API no disponible`**: el stack no está arriba o el puerto 3000 está
  ocupado. `docker compose up -d` y `docker compose logs api`.
- **`login ... devolvió 401` o `Falta el seed`**: faltan las migraciones o el
  seed (pasos 3 y 4 de arriba).
- **El paso 4 no llega a lo esperado (sin sugerencias de IA)**: revisa que
  `.env` tenga `LLM_HABILITADO=true` y `LLM_PROVEEDOR=simulado` (vienen en
  `.env.example`) y reinicia con `docker compose up -d api`.
- **La carga se queda en un estado intermedio**: el worker corre dentro de la
  api; revisa `docker compose logs api` y que Redis esté sano.

## Interfaz (frontend)

La interfaz vive en `frontend/` (React, Vite y TypeScript) y es un proyecto
aparte del API: tiene su propio `package.json` y su propio `package-lock.json`.

Requisitos: Node 22.22 o superior (o 24.15 o superior) y el API arriba
(`docker compose up -d`, ver "De cero a la demo").

```bash
cd frontend && npm install && npm run dev
```

Abre `http://localhost:5173`. El navegador llama al API por `/api/*`; el
servidor de desarrollo reenvía esas peticiones a `http://localhost:3000` sin
el prefijo `/api`, así que el backend no necesita CORS. Para apuntar a otro
destino define `API_TARGET` (hay un ejemplo en `frontend/.env.example`):

```bash
API_TARGET=http://api:3000 npm run dev
```

Swagger sigue en `http://localhost:3000/docs`, directo y sin proxy.

### Iniciar sesión en la interfaz

Con el API arriba y `npm run dev` corriendo en `frontend/`:

1. Abre `http://localhost:5173`.
2. Entra con cualquier persona de la tabla "Usuarios de la demo".
3. Elige la empresa. Con varias empresas, el encabezado permite cambiar
   de una a otra; "Cerrar sesión" termina la sesión en esa pestaña.

Recargar la página te saca de la sesión, a propósito: los tokens viven solo
en la memoria de la pestaña. Cerrar sesión los descarta ahí, pero el API no
tiene endpoint de cierre, así que no revoca el token en el servidor.

El tema (claro u oscuro) sigue al del sistema operativo hasta que la persona
elige uno; esa elección se guarda en el navegador (`localStorage`, clave
`cuadra.tema`) y se mantiene al recargar. Un script en línea de
`frontend/index.html` lo aplica antes del primer pintado para evitar el
parpadeo; si algún día se agrega una CSP, ese script necesitará un hash o un
nonce.

## Pruebas

Necesitan Postgres y Redis arriba (`docker compose up -d`):

```bash
npm test            # todas las pruebas, sin ANTHROPIC_API_KEY
npm run typecheck
npm run build
```

Incluyen una prueba de integración (`src/demo/demo.integracion.spec.ts`) que
corre el mismo runner de la demo contra la app real, con el proveedor simulado.
Ninguna prueba llama a una API de IA real.

Las del frontend corren desde `frontend/` y no necesitan Postgres ni Redis:

```bash
cd frontend
npm test            # Vitest, una sola corrida
npm run typecheck
npm run lint        # solo revisa; `npm run lint:fix` corrige
npm run format:check
npm run build
```
