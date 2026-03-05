import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { RunCleanupService } from './run-cleanup.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [RunCleanupService],
})
export class RunCleanupModule {}
