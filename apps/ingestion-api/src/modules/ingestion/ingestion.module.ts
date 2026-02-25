import { createDbConnection, type Transaction } from '@assertly/database';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDialect } from '@outboxy/dialect-postgres';
import { OutboxyModule, OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';

import { DATABASE_CONNECTION } from '../../constants';
import { type EnvConfig } from '../config/env.validation';

import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { ArtifactService } from './services/artifact.service';
import { RunService } from './services/run.service';
import { SuiteService } from './services/suite.service';
import { TestService } from './services/test.service';

@Module({
  imports: [
    OutboxyModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => ({
        dialect: new PostgreSqlDialect(),
        adapter: (tx: Transaction) => async (sql: string, params: unknown[]) => {
          // Drizzle doesn't expose the raw postgres-js client in its public types
          type RawSqlClient = {
            unsafe: (sql: string, params: unknown[]) => Promise<{ id: string }[]>;
          };
          const client = (tx as unknown as { session: { client: RawSqlClient } }).session.client;
          return client.unsafe(sql, params);
        },
        defaultDestinationUrl:
          config.get<string>('WORKER_WEBHOOK_URL') ?? 'http://worker:3001/webhooks/outboxy',
        defaultDestinationType: 'http' as const,
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
    RunService,
    SuiteService,
    TestService,
    ArtifactService,
  ],
  exports: [IngestionService, DATABASE_CONNECTION, OUTBOXY_CLIENT],
})
export class IngestionModule {}
