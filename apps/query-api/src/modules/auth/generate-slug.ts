import { randomBytes } from 'node:crypto';

export function generateSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  if (!slug) {
    return `org-${randomBytes(2).toString('hex')}`;
  }

  return slug;
}
