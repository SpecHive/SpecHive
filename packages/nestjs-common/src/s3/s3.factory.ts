import type { ConfigService } from '@nestjs/config';

import type { S3ModuleConfig } from './s3.constants.js';

export interface S3FactoryEnvConfig {
  MINIO_ENDPOINT: string;
  MINIO_PUBLIC_ENDPOINT: string;
  MINIO_APP_ACCESS_KEY: string;
  MINIO_APP_SECRET_KEY: string;
  MINIO_USE_SSL: string;
  MINIO_PUBLIC_USE_SSL?: string | undefined;
  MINIO_BUCKET: string;
}

export function createS3ModuleOptions<T extends S3FactoryEnvConfig>(
  config: ConfigService<T>,
): S3ModuleConfig {
  return {
    endpoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
    publicEndpoint: config.getOrThrow<string>('MINIO_PUBLIC_ENDPOINT'),
    region: 'us-east-1',
    accessKeyId: config.getOrThrow<string>('MINIO_APP_ACCESS_KEY'),
    secretAccessKey: config.getOrThrow<string>('MINIO_APP_SECRET_KEY'),
    useSSL: config.getOrThrow<string>('MINIO_USE_SSL') === 'true',
    publicUseSSL:
      (config.get<string>('MINIO_PUBLIC_USE_SSL') ?? config.getOrThrow<string>('MINIO_USE_SSL')) ===
      'true',
    bucket: config.getOrThrow<string>('MINIO_BUCKET'),
  };
}
