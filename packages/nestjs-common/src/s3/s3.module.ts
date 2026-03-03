import { S3Client } from '@aws-sdk/client-s3';
import { DynamicModule, type InjectionToken, Module } from '@nestjs/common';

import {
  S3_BUCKET,
  S3_CLIENT,
  S3_PRESIGNER_CLIENT,
  S3_PUBLIC_ENDPOINT,
  type S3ModuleConfig,
} from './s3.constants';
import { S3Service } from './s3.service';

const S3_CONFIG = Symbol('S3_CONFIG');

interface S3ModuleAsyncOptions<T extends unknown[] = unknown[]> {
  inject?: InjectionToken[];
  useFactory: (...args: T) => S3ModuleConfig | Promise<S3ModuleConfig>;
  isGlobal?: boolean;
}

function createS3Client(endpoint: string, useSSL: boolean, config: S3ModuleConfig): S3Client {
  const protocol = useSSL ? 'https' : 'http';
  return new S3Client({
    endpoint: `${protocol}://${endpoint}`,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

@Module({})
export class S3Module {
  static forRootAsync<T extends unknown[]>(options: S3ModuleAsyncOptions<T>): DynamicModule {
    return {
      module: S3Module,
      global: options.isGlobal ?? false,
      providers: [
        {
          provide: S3_CONFIG,
          inject: options.inject ?? [],
          useFactory: async (...args: T) => options.useFactory(...args),
        },
        {
          provide: S3_CLIENT,
          inject: [S3_CONFIG],
          useFactory: (config: S3ModuleConfig) =>
            createS3Client(config.endpoint, config.useSSL, config),
        },
        {
          provide: S3_PRESIGNER_CLIENT,
          inject: [S3_CONFIG],
          useFactory: (config: S3ModuleConfig) =>
            createS3Client(config.publicEndpoint, config.publicUseSSL, config),
        },
        {
          provide: S3_BUCKET,
          inject: [S3_CONFIG],
          useFactory: (config: S3ModuleConfig) => config.bucket,
        },
        {
          provide: S3_PUBLIC_ENDPOINT,
          inject: [S3_CONFIG],
          useFactory: (config: S3ModuleConfig) => config.publicEndpoint,
        },
        S3Service,
      ],
      exports: [S3Service, S3_CLIENT, S3_BUCKET, S3_PRESIGNER_CLIENT, S3_PUBLIC_ENDPOINT],
    };
  }
}
