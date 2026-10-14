# Despliegue de Cuadra

Procedimiento para levantar Cuadra completa en una máquina limpia con Docker
(historia 1.7, AD-16 y AD-17). Cada paso está escrito: si algo no está aquí,
es un defecto del documento.

## Qué levanta

| Servicio | Qué es | Notas |
|---|---|---|
| `postgres` | PostgreSQL 18 | Volumen `pgdata`. No se publica al host. |
| `redis` | Redis 7, `noeviction`, `appendonly` | Volumen `redisdata`. No se publica al host. |
| `api` | `node dist/main` | Puerto `${API_PUERTO:-3000}`. No consume las colas. |
| `worker` | `node dist/worker` | Misma imagen. Consume las colas de cargas y sugerencias. |
| `migrate` | Migraciones, un solo uso | Perfil `tools`. Nunca es dependencia de `api`. |

## Requisitos

- Docker con Compose v2.
- Este repositorio clonado.

## Procedimiento

1. **Variables.** Copia `.env.example` a `.env` y llénalo. Obligatorias:
   `POSTGRES_PASSWORD`, `CUADRA_APP_PASSWORD` y `ORIGEN_AUTORIZADO`. Con
   `NODE_ENV=production` también `CORREO_SMTP_HOST`, `CORREO_SMTP_PORT`,
   `CORREO_SMTP_USUARIO`, `CORREO_SMTP_PASSWORD` y `CORREO_REMITENTE`.
   Las contraseñas van dentro de URLs: usa solo `[A-Za-z0-9_-]` o codifícalas
   con porcentaje. Fuera de desarrollo la API rechaza `cuadra`, `cuadra_app`,
   vacío y `cambia-esta-contrasena`, y el mensaje nombra la variable.
2. **Levantar.** `docker compose up -d --build`. Si falta una variable
   obligatoria, Compose se detiene nombrándola.
3. **Migraciones (paso explícito).**
   `docker compose --profile tools run --rm migrate`. La primera vez crea el rol
   `cuadra_app` con `CUADRA_APP_PASSWORD`. La API nunca migra al arrancar.
4. **Dueño de la plataforma.** Con `DUENO_CORREO` y `DUENO_PASSWORD` en `.env`:
   `docker compose run --rm api node dist/database/seeds/sembrar-dueno.js`.
5. **Verificar.** `curl http://localhost:3000/health` informa el estado de
   PostgreSQL y de Redis.

## Respaldo y restauración

```
COMPOSE="docker compose" scripts/respaldo/respaldar.sh --verificar [base] [dir]
scripts/respaldo/restaurar.sh [--conservar] archivo.dump [base_origen]
```

- `respaldar.sh` escribe `<base>-<UTC>.dump` y `.conteos` (por omisión en
  `./respaldos`, modo 700). `--verificar` lo restaura en una base temporal y
  compara el conteo de filas de cada tabla.
- `restaurar.sh` restaura en `cuadra_restauracion_<ts>`, compara conteos, borra
  la base temporal y sale con 1 ante cualquier diferencia.
- Se toman los conteos justo antes de `pg_dump`: respalda sin carga de
  escritura o la comparación mostrará diferencias.
- Antes de cada demo se corre `--verificar`. Un respaldo no restaurado no cuenta
  como respaldo.
- Recuperar de verdad (reemplazar la base viva) es un paso manual y deliberado.

## Desarrollo

`docker compose -f docker-compose.dev.yml up -d --build`. La API consume las
colas dentro del mismo proceso, así que no hace falta worker. Migraciones y
siembra:
`docker compose -f docker-compose.dev.yml exec api npm run migration:run` y
`npm run seed`. Para no repetir `-f`, pon `COMPOSE_FILE=docker-compose.dev.yml`
en tu `.env` de desarrollo.

## Cómo se elegirá el host

No se decide hasta que llegue un cliente real (AD-17); el compose y las
variables ya lo permiten. Cuando llegue ese momento se decide en este orden,
quien decide es el dueño de Cuadra y se anota en la bitácora:

1. **Datos.** Dónde pueden vivir los datos fiscales del cliente (país y
   proveedor aceptables) y quién tiene acceso al servidor.
2. **Respaldo y restauración.** Que el host permita volúmenes persistentes y
   correr `respaldar.sh --verificar` sin pasos manuales.
3. **Proxy y TLS.** Quién sirve el frontend, reenvía `/api` y termina TLS
   (AD-17 lo difiere): proxy inverso en el mismo host o servicio administrado.
4. **Correo.** Proveedor SMTP con dominio verificado para el remitente.
5. **Costo y operación.** Costo mensual y quién atiende una caída.

Mientras tanto no hay host elegido y este documento no promete uno.
