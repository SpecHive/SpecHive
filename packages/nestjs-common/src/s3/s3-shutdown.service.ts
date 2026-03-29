import type { S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { S3_CLIENT, S3_PRESIGNER_CLIENT } from './s3.constants';

@Injectable()
export class S3ShutdownService implements OnModuleDestroy {
  constructor(
    @InjectPinoLogger(S3ShutdownService.name) private readonly logger: PinoLogger,
    @Inject(S3_CLIENT) private readonly client: S3Client,
    @Inject(S3_PRESIGNER_CLIENT) private readonly presignerClient: S3Client,
  ) {}

  onModuleDestroy(): void {
    this.client.destroy();
    this.presignerClient.destroy();
    this.logger.info('S3 client destroyed');
  }
}
