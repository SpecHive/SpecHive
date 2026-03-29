import { Module } from '@nestjs/common';

import { ErrorsController } from './errors.controller';
import { ErrorsService } from './errors.service';
import { RunErrorsController } from './run-errors.controller';

@Module({
  controllers: [ErrorsController, RunErrorsController],
  providers: [ErrorsService],
})
export class ErrorsModule {}
