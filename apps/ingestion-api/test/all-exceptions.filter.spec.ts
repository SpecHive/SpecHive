import { AllExceptionsFilter } from '@assertly/nestjs-common';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi } from 'vitest';

function createMockHost() {
  const mockSend = vi.fn();
  const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
  const mockResponse = { status: mockStatus };

  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
      }),
    } as never,
    mockStatus,
    mockSend,
  };
}

function createFilter(nodeEnv: string) {
  const mockConfig = {
    get: vi.fn().mockReturnValue(nodeEnv),
  } as unknown as ConfigService;
  return new AllExceptionsFilter(mockConfig);
}

describe('AllExceptionsFilter', () => {
  it('returns correct status for HttpException', () => {
    const filter = createFilter('production');
    const { host, mockStatus, mockSend } = createMockHost();

    filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Not Found' }),
    );
  });

  it('returns 500 for non-HttpException', () => {
    const filter = createFilter('production');
    const { host, mockStatus, mockSend } = createMockHost();

    filter.catch(new Error('unexpected'), host);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
  });

  it('includes stack trace in development mode', () => {
    const filter = createFilter('development');
    const { host, mockSend } = createMockHost();
    const error = new Error('dev error');

    filter.catch(error, host);

    const body = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(body['stack']).toBeDefined();
    expect(typeof body['stack']).toBe('string');
  });

  it('excludes stack trace in production mode', () => {
    const filter = createFilter('production');
    const { host, mockSend } = createMockHost();
    const error = new Error('prod error');

    filter.catch(error, host);

    const body = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(body['stack']).toBeUndefined();
  });
});
