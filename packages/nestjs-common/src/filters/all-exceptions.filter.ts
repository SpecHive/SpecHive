import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { BaseEnvConfig } from '../config/base-env.schema';

const ERROR_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
};

function extractMessage(exceptionResponse: string | object, exception: unknown): unknown {
  if (
    typeof exceptionResponse === 'object' &&
    exceptionResponse !== null &&
    'message' in exceptionResponse
  ) {
    return (exceptionResponse as { message: unknown }).message;
  }
  if (exception instanceof Error) {
    return exception.message;
  }
  return 'Internal server error';
}

function extractCode(exceptionResponse: string | object, statusCode: number): string {
  if (
    typeof exceptionResponse === 'object' &&
    exceptionResponse !== null &&
    'code' in exceptionResponse &&
    typeof (exceptionResponse as { code: unknown }).code === 'string'
  ) {
    return (exceptionResponse as { code: string }).code;
  }
  return ERROR_CODES[statusCode] ?? 'INTERNAL_ERROR';
}

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

    const rawMessage = extractMessage(exceptionResponse, exception);

    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;

    const safeMessage =
      exception instanceof HttpException || this.isDevelopment ? message : 'Internal server error';

    const code = extractCode(exceptionResponse, statusCode);

    if (statusCode >= 500) {
      this.logger.error(
        `${statusCode} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${statusCode} ${message}`);
    }

    const body: Record<string, unknown> = {
      statusCode,
      code,
      message: safeMessage,
      timestamp: new Date().toISOString(),
    };

    if (this.isDevelopment && exception instanceof Error) {
      body['stack'] = exception.stack;
    }

    void response.status(statusCode).send(body);
  }
}
