import { describe, it, expect } from 'vitest';

import { StripInternalHeadersMiddleware } from '../src/middleware/strip-internal-headers.middleware';

describe('StripInternalHeadersMiddleware', () => {
  const middleware = new StripInternalHeadersMiddleware();

  function createReq(headers: Record<string, string>) {
    return { headers: { ...headers } };
  }

  it('removes x-user-id header', () => {
    const req = createReq({ 'x-user-id': 'spoofed-id' });
    middleware.use(req, {}, () => {});
    expect(req.headers).not.toHaveProperty('x-user-id');
  });

  it('removes x-organization-id header', () => {
    const req = createReq({ 'x-organization-id': 'spoofed-org' });
    middleware.use(req, {}, () => {});
    expect(req.headers).not.toHaveProperty('x-organization-id');
  });

  it('removes x-user-role header', () => {
    const req = createReq({ 'x-user-role': 'admin' });
    middleware.use(req, {}, () => {});
    expect(req.headers).not.toHaveProperty('x-user-role');
  });

  it('removes x-project-id header', () => {
    const req = createReq({ 'x-project-id': 'spoofed-project' });
    middleware.use(req, {}, () => {});
    expect(req.headers).not.toHaveProperty('x-project-id');
  });

  it('passes through non-internal headers unchanged', () => {
    const req = createReq({
      authorization: 'Bearer token',
      'content-type': 'application/json',
      'x-user-id': 'spoofed',
    });
    middleware.use(req, {}, () => {});

    expect(req.headers).toEqual({
      authorization: 'Bearer token',
      'content-type': 'application/json',
    });
  });

  it('calls next()', () => {
    const req = createReq({});
    let called = false;
    middleware.use(req, {}, () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});
