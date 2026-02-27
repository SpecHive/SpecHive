import { Module } from '@nestjs/common';

import {
  ArtifactUploadHandler,
  RunEndHandler,
  RunStartHandler,
  SuiteEndHandler,
  SuiteStartHandler,
  TestEndHandler,
  TestStartHandler,
} from './handlers';
import { ResultProcessorService } from './result-processor.service';

@Module({
  providers: [
    ResultProcessorService,
    RunStartHandler,
    RunEndHandler,
    SuiteStartHandler,
    SuiteEndHandler,
    TestStartHandler,
    TestEndHandler,
    ArtifactUploadHandler,
  ],
  exports: [ResultProcessorService],
})
export class ResultProcessorModule {}
