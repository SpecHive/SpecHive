import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDialect } from '@outboxy/dialect-postgres';
import { OutboxyModule } from '@outboxy/sdk-nestjs';
import { createOutboxyAdapter } from '@spechive/nestjs-common';

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
  providers: [IngestionService],
})
export class IngestionModule {}
