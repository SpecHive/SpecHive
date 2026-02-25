import { Module } from '@nestjs/common';

import { ResultProcessorService } from './result-processor.service';

@Module({
  providers: [ResultProcessorService],
  exports: [ResultProcessorService],
})
export class ResultProcessorModule {}
