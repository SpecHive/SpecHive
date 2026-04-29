FROM grafana/loki:3.5.0

COPY loki-config.yml /etc/loki/loki-config.yml

EXPOSE 3100
ENTRYPOINT ["/usr/bin/loki", "-config.file=/etc/loki/loki-config.yml"]
