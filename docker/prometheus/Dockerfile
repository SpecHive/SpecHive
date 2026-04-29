FROM prom/prometheus:v3.3.0

COPY prometheus.yml      /etc/prometheus/prometheus.yml
COPY recording-rules.yml /etc/prometheus/recording-rules.yml

USER root
EXPOSE 9090
