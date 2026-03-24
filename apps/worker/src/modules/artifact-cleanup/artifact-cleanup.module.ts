import { Module } from '@nestjs/common';

import { ArtifactCleanupService } from './artifact-cleanup.service';

@Module({
  providers: [ArtifactCleanupService],
})
export class ArtifactCleanupModule {}
