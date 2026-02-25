import { createDbConnection } from '@assertly/database';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDialect } from '@outboxy/dialect-postgres';
import { OutboxyModule, OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';

import { type EnvConfig } from '../config/env.validation';

import { IngestionController } from './ingestion.controller';
import { IngestionService, DATABASE_CONNECTION } from './ingestion.service';
import { ArtifactService } from './services/artifact.service';
import { RunService } from './services/run.service';
import { SuiteService } from './services/suite.service';
import { TestService } from './services/test.service';

@Module({
  imports: [
    OutboxyModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (...args: unknown[]) => {
        const config = args[0] as ConfigService<EnvConfig>;
        return {
          dialect: new PostgreSqlDialect(),
          adapter:
            (tx: { unsafe: (sql: string, params?: unknown[]) => Promise<{ id: string }[]> }) =>
            async (sql: string, params: unknown[]) => {
              return tx.unsafe(sql, params as never[]);
            },
          defaultDestinationUrl:
            config.get<string>('WORKER_WEBHOOK_URL') ?? 'http://worker:3001/webhooks/outboxy',
          defaultDestinationType: 'http' as const,
        };
      },
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
    RunService,
    SuiteService,
    TestService,
    ArtifactService,
  ],
  exports: [IngestionService, DATABASE_CONNECTION, OUTBOXY_CLIENT],
})
export class IngestionModule {}
