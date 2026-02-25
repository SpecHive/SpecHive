#!/bin/sh
set -e

# Wait for MinIO to be ready
until curl -sf http://minio:9000/minio/health/live; do
  echo "Waiting for MinIO..."
  sleep 2
done

# Configure mc alias
mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"

# Create default bucket if it doesn't already exist
if ! mc ls local/assertly-artifacts > /dev/null 2>&1; then
  mc mb local/assertly-artifacts
  echo "Bucket 'assertly-artifacts' created."
else
  echo "Bucket 'assertly-artifacts' already exists."
fi
