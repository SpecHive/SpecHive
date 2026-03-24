import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { BaseEnvConfig } from '../src/config/base-env.schema';
import { AllExceptionsFilter } from '../src/filters/all-exceptions.filter';

function makeConfigService(nodeEnv: string): ConfigService<BaseEnvConfig> {
  return {
    get: vi.fn().mockReturnValue(nodeEnv),
  } as unknown as ConfigService<BaseEnvConfig>;
}

function makeHost(responseMock: {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => responseMock,
    }),
  } as unknown as ArgumentsHost;
}

function makeSendCapture() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  return { status, send };
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

describe('AllExceptionsFilter', () => {
  describe('status code resolution', () => {
    it('uses the HttpException status for HttpException errors', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('uses 500 for non-HttpException errors', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new Error('boom'), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('message resolution', () => {
    it('uses the string message from an HttpException', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED), host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.message).toBe('Unauthorized');
    });

    it('extracts message from an HttpException object payload', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      // HttpException with an object response carries { message, statusCode, error }
      filter.catch(
        new HttpException({ message: 'Custom object message' }, HttpStatus.BAD_REQUEST),
        host,
      );

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.message).toBe('Custom object message');
    });

    it('uses "Internal server error" for non-HttpException non-Error values', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch('a plain string throw', host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.message).toBe('Internal server error');
    });
  });

  describe('production message sanitization', () => {
    it('hides raw error message for plain Error in production', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new Error('sensitive internal detail'), host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.message).toBe('Internal server error');
    });

    it('exposes raw error message for plain Error in development', () => {
      const filter = new AllExceptionsFilter(makeConfigService('development'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new Error('sensitive internal detail'), host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.message).toBe('sensitive internal detail');
    });
  });

  describe('stack trace inclusion', () => {
    it('includes stack in development mode when the exception is an Error', () => {
      const filter = new AllExceptionsFilter(makeConfigService('development'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });
      const error = new Error('dev error');

      filter.catch(error, host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.stack).toBe(error.stack);
    });

    it('excludes stack in production mode', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new Error('prod error'), host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.stack).toBeUndefined();
    });

    it('excludes stack in development mode when the exception is not an Error', () => {
      const filter = new AllExceptionsFilter(makeConfigService('development'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch('not an Error object', host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.stack).toBeUndefined();
    });
  });

  describe('error code resolution', () => {
    it.each([
      [HttpStatus.NOT_FOUND, 'NOT_FOUND'],
      [HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED'],
      [HttpStatus.CONFLICT, 'CONFLICT'],
      [HttpStatus.METHOD_NOT_ALLOWED, 'METHOD_NOT_ALLOWED'],
      [HttpStatus.REQUEST_TIMEOUT, 'REQUEST_TIMEOUT'],
      [HttpStatus.UNPROCESSABLE_ENTITY, 'UNPROCESSABLE_ENTITY'],
    ])('maps %i to %s', (httpStatus, expectedCode) => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new HttpException('test', httpStatus), host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.code).toBe(expectedCode);
    });

    it('propagates custom code from exception payload', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(
        new HttpException(
          { message: 'Invalid input', code: 'CUSTOM_CODE' },
          HttpStatus.BAD_REQUEST,
        ),
        host,
      );

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.code).toBe('CUSTOM_CODE');
    });

    it('falls back to INTERNAL_ERROR for non-HttpException errors', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new Error('boom'), host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('log severity', () => {
    beforeEach(() => {
      (Logger.prototype.error as ReturnType<typeof vi.fn>).mockClear();
      (Logger.prototype.warn as ReturnType<typeof vi.fn>).mockClear();
    });

    it('logs 5xx at error level', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new Error('boom'), host);

      expect(Logger.prototype.error).toHaveBeenCalled();
      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    });

    it('logs 4xx at warn level', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new HttpException('bad request', HttpStatus.BAD_REQUEST), host);

      expect(Logger.prototype.warn).toHaveBeenCalled();
      expect(Logger.prototype.error).not.toHaveBeenCalled();
    });

    it('logs 404 at warn level', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new HttpException('not found', HttpStatus.NOT_FOUND), host);

      expect(Logger.prototype.warn).toHaveBeenCalled();
      expect(Logger.prototype.error).not.toHaveBeenCalled();
    });
  });

  describe('response body structure', () => {
    it('always includes a timestamp field in ISO 8601 format', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new Error('any'), host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(typeof body.timestamp).toBe('string');
      expect(() => new Date(body.timestamp as string)).not.toThrow();
      expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
    });

    it('always includes statusCode in the response body', () => {
      const filter = new AllExceptionsFilter(makeConfigService('production'));
      const { status, send } = makeSendCapture();
      const host = makeHost({ status, send });

      filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), host);

      const body = send.mock.calls[0][0] as Record<string, unknown>;
      expect(body.statusCode).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
