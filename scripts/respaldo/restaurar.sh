#!/usr/bin/env bash
# Restaura un respaldo de respaldar.sh en una base TEMPORAL y compara las filas
# de todas las tablas del esquema public. Sale con 0 solo si coinciden todas;
# con 1 si hay una diferencia, una tabla faltante o sobrante, o un error.
# No toca la base original.
#
# Uso:  scripts/respaldo/restaurar.sh [--conservar] archivo.dump [base_origen]
#   --conservar   no borra la base temporal al terminar
#   base_origen   si no hay <archivo>.conteos, se compara contra esta base
#                 (por defecto $BASE o `cuadra`); con .conteos se usa ese
#   BASE_TEMPORAL nombre de la base temporal (por defecto
#                 cuadra_restauracion_<fecha>)
#
# Restaurar de verdad (recuperación) es otro paso, a propósito manual: crea la
# base destino y corre pg_restore sobre ella; ver la guía de despliegue.
set -euo pipefail
aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=comun.sh
source "$aqui/comun.sh"

conservar=0
args=()
for a in "$@"; do
  if [[ "$a" == "--conservar" ]]; then conservar=1; else args+=("$a"); fi
done
archivo="${args[0]:-}"
[[ -n "$archivo" ]] || falla "uso: restaurar.sh [--conservar] archivo.dump [base_origen]"
[[ -s "$archivo" ]] || falla "no existe o está vacío: $archivo"
origen="${args[1]:-${BASE:-cuadra}}"
temporal="${BASE_TEMPORAL:-cuadra_restauracion_$(date -u +%Y%m%d%H%M%S)}"
nombre_valido "$origen"
nombre_valido "$temporal"
[[ "$temporal" != "$origen" ]] || falla "la base temporal no puede ser la de origen"

trabajo="$(mktemp -d)"
limpiar() {
  rm -rf "$trabajo"
  if [[ "$conservar" == 0 ]]; then
    psql_base postgres -c "DROP DATABASE IF EXISTS \"$temporal\" WITH (FORCE)" \
      >/dev/null 2>&1 || echo "aviso: no pude borrar '$temporal'" >&2
  else
    echo "Base temporal conservada: $temporal"
  fi
}
trap limpiar EXIT

existe="$(psql_base postgres -c "SELECT 1 FROM pg_database WHERE datname = '$temporal'")"
[[ -z "$existe" ]] || falla "la base temporal '$temporal' ya existe"

echo "Restaurando $archivo en la base temporal '$temporal' ..."
psql_base postgres -c "CREATE DATABASE \"$temporal\"" >/dev/null
pg pg_restore -U "$PG_USUARIO" -d "$temporal" --exit-on-error --no-password \
  <"$archivo" || falla "pg_restore falló"

conteos "$temporal" >"$trabajo/restaurado"
if [[ -s "$archivo.conteos" ]]; then
  cp "$archivo.conteos" "$trabajo/esperado"
  referencia="$archivo.conteos (al respaldar)"
else
  conteos "$origen" >"$trabajo/esperado"
  referencia="base '$origen' (ahora)"
fi
[[ -s "$trabajo/esperado" ]] || falla "no pude obtener los conteos de referencia"

echo "Referencia: $referencia"
printf '%-28s %12s %12s\n' tabla esperado restaurado
mal=0
while IFS='|' read -r tabla esperado; do
  restaurado="$(awk -F'|' -v t="$tabla" '$1 == t { print $2 }' "$trabajo/restaurado")"
  marca=''
  if [[ -z "$restaurado" ]]; then
    restaurado='FALTA'
    marca='  <-- DIFERENTE'
    mal=1
  elif [[ "$restaurado" != "$esperado" ]]; then
    marca='  <-- DIFERENTE'
    mal=1
  fi
  printf '%-28s %12s %12s%s\n' "$tabla" "$esperado" "$restaurado" "$marca"
done <"$trabajo/esperado"
# Tablas que existen restauradas y no en la referencia.
while IFS='|' read -r tabla restaurado; do
  if ! grep -q "^$tabla|" "$trabajo/esperado"; then
    printf '%-28s %12s %12s  <-- SOBRA\n' "$tabla" '-' "$restaurado"
    mal=1
  fi
done <"$trabajo/restaurado"

if [[ "$mal" != 0 ]]; then
  echo "RESPALDO NO VERIFICADO: los conteos no coinciden." >&2
  exit 1
fi
echo "OK: el respaldo se restauró y todos los conteos coinciden."
