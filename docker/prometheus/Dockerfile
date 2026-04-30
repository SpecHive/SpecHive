FROM prom/prometheus:v3.3.0

COPY prometheus.yml.template /etc/prometheus/prometheus.yml.template
COPY recording-rules.yml     /etc/prometheus/recording-rules.yml
COPY entrypoint.sh           /entrypoint.sh

USER root
EXPOSE 9090
ENTRYPOINT ["/entrypoint.sh"]
