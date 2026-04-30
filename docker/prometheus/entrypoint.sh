#!/bin/sh
# Substitute ${VAR} placeholders in prometheus.yml.template with environment values,
# then exec prometheus. Fails loudly if any referenced var is missing.
set -eu

template=/etc/prometheus/prometheus.yml.template
output=/etc/prometheus/prometheus.yml

awk '
{
  while (match($0, /\$\{[A-Z_][A-Z0-9_]*\}/)) {
    var = substr($0, RSTART+2, RLENGTH-3)
    if (!(var in ENVIRON)) {
      printf "ERROR: required env var %s referenced in prometheus.yml.template is not set\n", var > "/dev/stderr"
      exit 1
    }
    $0 = substr($0, 1, RSTART-1) ENVIRON[var] substr($0, RSTART+RLENGTH)
  }
  print
}
' "$template" > "$output"

exec /bin/prometheus --config.file="$output" --storage.tsdb.path=/prometheus "$@"
