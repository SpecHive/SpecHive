import { describe, it, expect } from 'vitest';

import { sanitizeArtifactName, MAX_ARTIFACT_NAME_LENGTH, stripAnsi } from '../utils/sanitize.js';

describe('sanitizeArtifactName', () => {
  it('passes through a clean name unchanged', () => {
    expect(sanitizeArtifactName('screenshot.png')).toBe('screenshot.png');
  });

  it('replaces path traversal sequences', () => {
    expect(sanitizeArtifactName('../../../etc/passwd')).toBe('______etc_passwd');
  });

  it('replaces URL-encoded double-dot (%2e%2e)', () => {
    expect(sanitizeArtifactName('%2e%2e/secret')).toBe('__secret');
  });

  it('replaces URL-encoded forward slash (%2f)', () => {
    expect(sanitizeArtifactName('path%2fto%2ffile')).toBe('path_to_file');
  });

  it('replaces URL-encoded backslash (%5c)', () => {
    expect(sanitizeArtifactName('path%5cto%5cfile')).toBe('path_to_file');
  });

  it('replaces URL-encoded null byte (%00)', () => {
    expect(sanitizeArtifactName('file%00.txt')).toBe('file_.txt');
  });

  it('replaces literal null bytes', () => {
    expect(sanitizeArtifactName('file\0.txt')).toBe('file_.txt');
  });

  it('replaces forward slashes', () => {
    expect(sanitizeArtifactName('path/to/file.txt')).toBe('path_to_file.txt');
  });

  it('replaces backslashes', () => {
    expect(sanitizeArtifactName('path\\to\\file.txt')).toBe('path_to_file.txt');
  });

  it('replaces Windows-reserved characters', () => {
    expect(sanitizeArtifactName('file<>:"|?*.txt')).toBe('file_______.txt');
  });

  it('truncates at MAX_ARTIFACT_NAME_LENGTH (255)', () => {
    const longName = 'a'.repeat(300);
    const result = sanitizeArtifactName(longName);
    expect(result).toHaveLength(MAX_ARTIFACT_NAME_LENGTH);
    expect(result).toBe('a'.repeat(255));
  });

  it('handles empty string', () => {
    expect(sanitizeArtifactName('')).toBe('');
  });

  it('handles combined dangerous patterns', () => {
    const dangerous = '..\\../%2e%2e%2f%5c%00<>:"|?*malicious.exe';
    const result = sanitizeArtifactName(dangerous);
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('\0');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('is case-insensitive for URL-encoded sequences', () => {
    expect(sanitizeArtifactName('%2E%2E%2F%5C%00')).toBe('____');
  });
});

describe('stripAnsi', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  it('strips SGR color codes', () => {
    expect(stripAnsi('\x1b[31mError\x1b[39m')).toBe('Error');
  });

  it('strips dim and bold codes', () => {
    expect(stripAnsi('\x1b[2mexpect(\x1b[22m \x1b[31mreceived\x1b[39m')).toBe('expect( received');
  });

  it('strips multiple codes in a Playwright-style error', () => {
    const input =
      '\x1b[2mexpect(\x1b[22m\x1b[31mreceived\x1b[39m\x1b[2m).\x1b[22mtoBeVisible\x1b[2m()\x1b[22m';
    expect(stripAnsi(input)).toBe('expect(received).toBeVisible()');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('handles string with only ANSI codes', () => {
    expect(stripAnsi('\x1b[31m\x1b[39m')).toBe('');
  });

  it('strips 256-color and RGB sequences', () => {
    expect(stripAnsi('\x1b[38;5;196mred text\x1b[0m')).toBe('red text');
  });
});
