#!/usr/bin/env bash
# Utilidades compartidas por respaldar.sh y restaurar.sh (se cargan con source).
#
# Variables (todas opcionales; ningún secreto: se entra por el socket local del
# contenedor de Postgres):
#   COMPOSE   comando de compose            (por defecto: docker compose)
#   SERVICIO  servicio de Postgres          (por defecto: postgres)
#   PG_USUARIO  rol dueño del esquema       (por defecto: cuadra)
#
# Requiere un rol superusuario (el de POSTGRES_USER en la imagen oficial): con
# RLS FORCE, un dueño sin BYPASSRLS vería cero filas y el conteo mentiría.

SERVICIO="${SERVICIO:-postgres}"
PG_USUARIO="${PG_USUARIO:-cuadra}"
read -r -a DC <<<"${COMPOSE:-docker compose}"

falla() {
  echo "error: $*" >&2
  exit 1
}

# Solo minúsculas, números y guion bajo: el nombre se interpola en SQL.
nombre_valido() {
  [[ "$1" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || falla "nombre de base no válido: '$1'"
}

pg() {
  "${DC[@]}" exec -T "$SERVICIO" "$@"
}

psql_base() {
  local base="$1"
  shift
  pg psql -U "$PG_USUARIO" -d "$base" -v ON_ERROR_STOP=1 -X -A -t "$@"
}

# `tabla|filas` de TODAS las tablas del esquema public, ordenadas. La lista sale
# del catálogo, no de una lista escrita a mano: una tabla nueva entra sola.
conteos() {
  psql_base "$1" -F '|' -c "
    SELECT table_name,
           (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM %I.%I',
                                      table_schema, table_name),
                               false, true, '')))[1]::text::bigint
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name"
}
