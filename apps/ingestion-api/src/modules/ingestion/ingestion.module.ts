import { createDbConnection } from '@assertly/database';
import { createOutboxyAdapter, DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDialect } from '@outboxy/dialect-postgres';
import { OutboxyModule } from '@outboxy/sdk-nestjs';

import { type EnvConfig } from '../config/env.validation';

import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    OutboxyModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => ({
        dialect: new PostgreSqlDialect(),
        adapter: createOutboxyAdapter(),
        defaultDestinationUrl: config.getOrThrow<string>('WORKER_WEBHOOK_URL'),
        defaultDestinationType: 'http' as const,
        defaultHeaders: { 'x-webhook-secret': config.getOrThrow<string>('WEBHOOK_SECRET') },
      }),
      isGlobal: false,
    }),
  ],
  controllers: [IngestionController],
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        return createDbConnection(databaseUrl);
      },
    },
    IngestionService,
  ],
})
export class IngestionModule {}
