FROM grafana/loki:3.5.0

COPY loki-config.yml /etc/loki/loki-config.yml

# Run as root so Railway-mounted volumes (root-owned by default) are writable.
# Loki defaults to uid 10001 which can't write to /loki on a fresh mount.
USER root

EXPOSE 3100
ENTRYPOINT ["/usr/bin/loki", "-config.file=/etc/loki/loki-config.yml"]
