import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { bootstrapNestApp } from '../src/bootstrap/bootstrap-app';
import { AllExceptionsFilter } from '../src/filters/all-exceptions.filter';

const {
  mockRegister,
  mockEnableShutdownHooks,
  mockEnableCors,
  mockUseGlobalFilters,
  mockListen,
  mockGet,
  mockApp,
} = vi.hoisted(() => {
  const mockRegister = vi.fn().mockResolvedValue(undefined);
  const mockEnableShutdownHooks = vi.fn();
  const mockEnableCors = vi.fn();
  const mockUseGlobalFilters = vi.fn();
  const mockListen = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();

  return {
    mockRegister,
    mockEnableShutdownHooks,
    mockEnableCors,
    mockUseGlobalFilters,
    mockListen,
    mockGet,
    mockApp: {
      enableShutdownHooks: mockEnableShutdownHooks,
      register: mockRegister,
      get: mockGet,
      enableCors: mockEnableCors,
      useGlobalFilters: mockUseGlobalFilters,
      listen: mockListen,
    },
  };
});

vi.mock('@nestjs/core', () => ({
  NestFactory: {
    create: vi.fn().mockResolvedValue(mockApp),
  },
}));

vi.mock('@fastify/helmet', () => ({
  default: Symbol.for('helmet'),
}));

class FakeModule {}

function setupConfigMock(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = { PORT: 3000, NODE_ENV: 'test' };
  const merged = { ...defaults, ...overrides };
  mockGet.mockReturnValue({
    getOrThrow: vi.fn().mockImplementation((key: string) => merged[key]),
    get: vi.fn().mockImplementation((key: string) => merged[key]),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bootstrapNestApp', () => {
  it('creates the app with FastifyAdapter', async () => {
    setupConfigMock();
    await bootstrapNestApp({ module: FakeModule });

    expect(NestFactory.create).toHaveBeenCalledWith(FakeModule, expect.any(FastifyAdapter));
  });

  it('enables shutdown hooks', async () => {
    setupConfigMock();
    await bootstrapNestApp({ module: FakeModule });

    expect(mockEnableShutdownHooks).toHaveBeenCalled();
  });

  it('registers @fastify/helmet', async () => {
    setupConfigMock();
    await bootstrapNestApp({ module: FakeModule });

    expect(mockRegister).toHaveBeenCalledWith(Symbol.for('helmet'));
  });

  it('enables CORS when cors option is set', async () => {
    const corsOrigin = 'http://localhost:5173';
    setupConfigMock({ CORS_ORIGIN: corsOrigin });

    await bootstrapNestApp({ module: FakeModule, cors: true });

    expect(mockEnableCors).toHaveBeenCalledWith({
      origin: corsOrigin,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      credentials: true,
    });
  });

  it('does not enable CORS when cors option is false', async () => {
    setupConfigMock();
    await bootstrapNestApp({ module: FakeModule, cors: false });

    expect(mockEnableCors).not.toHaveBeenCalled();
  });

  it('sets AllExceptionsFilter globally', async () => {
    setupConfigMock();
    await bootstrapNestApp({ module: FakeModule });

    expect(mockUseGlobalFilters).toHaveBeenCalledWith(expect.any(AllExceptionsFilter));
  });

  it('listens on the configured PORT', async () => {
    const port = 8080;
    setupConfigMock({ PORT: port });

    await bootstrapNestApp({ module: FakeModule });

    expect(mockListen).toHaveBeenCalledWith(port, '0.0.0.0');
  });

  it('passes bodyLimit to FastifyAdapter when specified', async () => {
    setupConfigMock();
    await bootstrapNestApp({ module: FakeModule, bodyLimit: 1_048_576 });

    const createCall = vi.mocked(NestFactory.create).mock.calls[0]!;
    const adapter = createCall[1] as FastifyAdapter;
    expect(adapter).toBeInstanceOf(FastifyAdapter);
  });
});
