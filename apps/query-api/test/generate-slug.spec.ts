import { describe, it, expect } from 'vitest';

import { generateSlug } from '../src/modules/auth/generate-slug';

describe('generateSlug', () => {
  it('converts basic name to slug', () => {
    expect(generateSlug('My Company')).toBe('my-company');
  });

  it('transliterates accented characters', () => {
    expect(generateSlug('Héllo Wörld!')).toBe('hello-world');
  });

  it('falls back for unicode-only input', () => {
    const slug = generateSlug('日本語');
    expect(slug).toMatch(/^org-[0-9a-f]{4}$/);
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(generateSlug('foo  --  bar')).toBe('foo-bar');
  });

  it('trims leading and trailing special characters', () => {
    expect(generateSlug('--hello--')).toBe('hello');
  });

  it('truncates to 100 characters', () => {
    const long = 'a'.repeat(200);
    expect(generateSlug(long).length).toBe(100);
  });

  it('handles empty string', () => {
    const slug = generateSlug('');
    expect(slug).toMatch(/^org-[0-9a-f]{4}$/);
  });

  it('handles whitespace-only input', () => {
    const slug = generateSlug('   ');
    expect(slug).toMatch(/^org-[0-9a-f]{4}$/);
  });
});
