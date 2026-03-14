import { Module } from '@nestjs/common';

import { AuthProxyController } from './controllers/auth-proxy.controller';
import { IngestionProxyController } from './controllers/ingestion-proxy.controller';
import { QueryProxyController } from './controllers/query-proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  // Registration order matters: specific-path controllers (Ingestion, Auth)
  // must precede Query's @All('*') catch-all to avoid route shadowing.
  controllers: [IngestionProxyController, AuthProxyController, QueryProxyController],
  providers: [ProxyService],
})
export class ProxyModule {}
