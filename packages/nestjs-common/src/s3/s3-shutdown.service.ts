import type { S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { S3_CLIENT, S3_PRESIGNER_CLIENT } from './s3.constants';

@Injectable()
export class S3ShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(S3ShutdownService.name);

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    @Inject(S3_PRESIGNER_CLIENT) private readonly presignerClient: S3Client,
  ) {}

  onModuleDestroy(): void {
    this.client.destroy();
    this.presignerClient.destroy();
    this.logger.log('S3 client destroyed');
  }
}
