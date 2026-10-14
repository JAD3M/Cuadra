#!/usr/bin/env bash
# Respaldo de la base de Cuadra: pg_dump en formato custom, hecho dentro del
# contenedor de Postgres. Deja dos archivos junto al respaldo:
#   <base>-<fecha>.dump      el respaldo
#   <base>-<fecha>.conteos   filas por tabla al respaldar (para verificarlo)
#
# Uso:  scripts/respaldo/respaldar.sh [--verificar] [base] [directorio]
#   base        por defecto $BASE o `cuadra`
#   directorio  por defecto $DESTINO o `./respaldos`
#   --verificar restaura el respaldo en una base temporal y compara conteos
#               (AD-17: un respaldo no es bueno hasta restaurarlo)
#
# Los respaldos contienen datos de las empresas: guárdalos fuera del
# repositorio y con permisos restringidos (el directorio se crea con 700).
set -euo pipefail
aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=comun.sh
source "$aqui/comun.sh"

verificar=0
args=()
for a in "$@"; do
  if [[ "$a" == "--verificar" ]]; then verificar=1; else args+=("$a"); fi
done
base="${args[0]:-${BASE:-cuadra}}"
destino="${args[1]:-${DESTINO:-./respaldos}}"
nombre_valido "$base"

umask 077
mkdir -p "$destino"
sello="$(date -u +%Y%m%dT%H%M%SZ)"
archivo="$destino/$base-$sello.dump"

echo "Respaldando '$base' en $archivo ..."
# Conteos justo antes del dump; si hay escrituras entre ambos pasos, la
# verificación lo delatará como diferencia (corre el respaldo sin carga).
conteos "$base" >"$archivo.conteos"
pg pg_dump -U "$PG_USUARIO" -d "$base" --format=custom --no-password >"$archivo"
[[ -s "$archivo" ]] || falla "el respaldo salió vacío: $archivo"
echo "Respaldo listo: $archivo ($(wc -c <"$archivo") bytes, $(wc -l <"$archivo.conteos") tablas)"

if [[ "$verificar" == 1 ]]; then
  "$aqui/restaurar.sh" "$archivo"
else
  echo "Aún no está verificado: scripts/respaldo/restaurar.sh '$archivo'"
fi
