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

# Create a scoped service account for application access (PutObject, GetObject, ListBucket only)
MINIO_APP_ACCESS_KEY="${MINIO_APP_ACCESS_KEY:-assertly-app}"
MINIO_APP_SECRET_KEY="${MINIO_APP_SECRET_KEY:-assertly-app-secret-key}"

# Create the policy (inline JSON)
cat > /tmp/app-policy.json <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${BUCKET}",
        "arn:aws:s3:::${BUCKET}/*"
      ]
    }
  ]
}
POLICY

# Idempotent helper — treats "already exists" as success
run_idempotent() {
  local label="$1"; shift
  OUTPUT=$("$@" 2>&1) \
    && echo "${label} succeeded." \
    || {
      if echo "$OUTPUT" | grep -qi "already.*exist\|already.*attach"; then
        echo "${label}: already exists, skipping."
      else
        echo "WARNING: ${label} failed: $OUTPUT" >&2
      fi
    }
}

run_idempotent "Policy create" mc admin policy create local assertly-app-policy /tmp/app-policy.json
run_idempotent "User create" mc admin user add local "${MINIO_APP_ACCESS_KEY}" "${MINIO_APP_SECRET_KEY}"
run_idempotent "Policy attach" mc admin policy attach local assertly-app-policy --user "${MINIO_APP_ACCESS_KEY}"

echo "Scoped MinIO service account configured."
