import { Module } from '@nestjs/common';

import {
  ArtifactUploadHandler,
  EVENT_HANDLER,
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
    {
      provide: EVENT_HANDLER,
      useFactory: (
        runStart: RunStartHandler,
        runEnd: RunEndHandler,
        suiteStart: SuiteStartHandler,
        suiteEnd: SuiteEndHandler,
        testStart: TestStartHandler,
        testEnd: TestEndHandler,
        artifactUpload: ArtifactUploadHandler,
      ) => [runStart, runEnd, suiteStart, suiteEnd, testStart, testEnd, artifactUpload],
      inject: [
        RunStartHandler,
        RunEndHandler,
        SuiteStartHandler,
        SuiteEndHandler,
        TestStartHandler,
        TestEndHandler,
        ArtifactUploadHandler,
      ],
    },
  ],
  exports: [ResultProcessorService],
})
export class ResultProcessorModule {}
