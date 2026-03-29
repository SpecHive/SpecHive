import { type ChildProcess, spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const QUERY_API_PORT = process.env['QUERY_API_TEST_PORT'] ?? '3092';
const QUERY_API_CWD = resolve(process.cwd(), 'apps/query-api');

async function waitForReady(port: string, maxAttempts = 40, delayMs = 500): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    `query-api did not become ready on port ${port} within ${maxAttempts * delayMs}ms`,
  );
}

function collectOutput(proc: ChildProcess): { stdout: string; stderr: string } {
  const output = { stdout: '', stderr: '' };
  proc.stdout?.on('data', (chunk: Buffer) => {
    output.stdout += chunk.toString();
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    output.stderr += chunk.toString();
  });
  return output;
}

interface ExitResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

function waitForExit(proc: ChildProcess, timeoutMs = 15_000): Promise<ExitResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Process did not exit within ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function isProcessRunning(proc: ChildProcess): boolean {
  return proc.exitCode === null && proc.signalCode === null;
}

describe('Graceful shutdown: query-api', () => {
  let child: ChildProcess | undefined;

  afterEach(async () => {
    if (child && isProcessRunning(child)) {
      child.kill('SIGKILL');
      await new Promise<void>((r) => child!.on('exit', () => r()));
    }
    child = undefined;
  });

  it('closes database pool and destroys S3 clients on SIGTERM', async () => {
    child = spawn('node', ['dist/main.js'], {
      cwd: QUERY_API_CWD,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: QUERY_API_PORT,
        NODE_ENV: 'test',
      },
    });

    const output = collectOutput(child);

    await waitForReady(QUERY_API_PORT);

    child.kill('SIGTERM');

    const exit = await waitForExit(child);

    // NestJS re-raises SIGTERM after shutdown hooks complete,
    // so exit code is null with signal SIGTERM (not process.exit(0))
    const cleanExit = exit.code === 0 || exit.signal === 'SIGTERM';
    expect(cleanExit, `Unexpected exit: code=${exit.code}, signal=${exit.signal}`).toBe(true);

    const combined = output.stdout + output.stderr;
    expect(combined).toContain('Database pool closed');
    expect(combined).toContain('S3 client destroyed');
  }, 30_000);
});
