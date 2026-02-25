#!/bin/sh
set -e

BUCKET="${MINIO_BUCKET:-assertly-artifacts}"

# Wait for MinIO to be ready (also configures the mc alias)
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null 2>&1; do
  echo "Waiting for MinIO..."
  sleep 2
done

# Create default bucket if it doesn't already exist
if ! mc ls "local/${BUCKET}" > /dev/null 2>&1; then
  mc mb "local/${BUCKET}"
  echo "Bucket '${BUCKET}' created."
else
  echo "Bucket '${BUCKET}' already exists."
fi
