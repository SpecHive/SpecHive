import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ArtifactCleanupService } from './artifact-cleanup.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ArtifactCleanupService],
})
export class ArtifactCleanupModule {}
