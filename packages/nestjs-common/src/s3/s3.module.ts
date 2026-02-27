import { S3Client } from '@aws-sdk/client-s3';
import { DynamicModule, Module } from '@nestjs/common';

import { S3_BUCKET, S3_CLIENT, type S3ModuleConfig } from './s3.constants';
import { S3Service } from './s3.service';

interface S3ModuleAsyncOptions {
  inject?: unknown[];
  useFactory: (...args: unknown[]) => S3ModuleConfig | Promise<S3ModuleConfig>;
  isGlobal?: boolean;
}

@Module({})
export class S3Module {
  static forRootAsync(options: S3ModuleAsyncOptions): DynamicModule {
    return {
      module: S3Module,
      global: options.isGlobal ?? false,
      providers: [
        {
          provide: S3_CLIENT,
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]) => {
            const config = await options.useFactory(...args);
            const protocol = config.useSSL ? 'https' : 'http';
            return new S3Client({
              endpoint: `${protocol}://${config.endpoint}`,
              region: config.region,
              credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
              },
              forcePathStyle: true,
            });
          },
        },
        {
          provide: S3_BUCKET,
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]) => {
            const config = await options.useFactory(...args);
            return config.bucket;
          },
        },
        S3Service,
      ],
      exports: [S3Service, S3_CLIENT, S3_BUCKET],
    };
  }
}
