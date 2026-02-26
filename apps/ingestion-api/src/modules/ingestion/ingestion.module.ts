import { createDbConnection, getRawClient, type Transaction } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDialect } from '@outboxy/dialect-postgres';
import { OutboxyModule } from '@outboxy/sdk-nestjs';

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
          const client = getRawClient(tx);
          return client.unsafe(sql, params as never[]);
        },
        defaultDestinationUrl: config.getOrThrow<string>('WORKER_WEBHOOK_URL'),
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
  exports: [IngestionService],
})
export class IngestionModule {}
