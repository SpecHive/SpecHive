import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { BaseEnvConfig } from '../config/base-env.schema';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isDevelopment: boolean;

  constructor(configService: ConfigService<BaseEnvConfig>) {
    this.isDevelopment = configService.get<string>('NODE_ENV') === 'development';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as Record<string, unknown>).message ||
          (exception instanceof Error ? exception.message : 'Internal server error');

    this.logger.error(
      `${statusCode} ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const body: Record<string, unknown> = {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    };

    if (this.isDevelopment && exception instanceof Error) {
      body['stack'] = exception.stack;
    }

    void response.status(statusCode).send(body);
  }
}
