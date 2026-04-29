FROM grafana/grafana:11.6.0

COPY provisioning/ /etc/grafana/provisioning/
COPY dashboards/   /var/lib/grafana/dashboards/

# Run as root so Railway-mounted volumes (root-owned by default) are writable.
# Grafana defaults to uid 472 which can't write to /var/lib/grafana on a fresh mount.
USER root

EXPOSE 3000
