import { Module } from '@nestjs/common';

import { RunCleanupService } from './run-cleanup.service';

@Module({
  providers: [RunCleanupService],
})
export class RunCleanupModule {}
