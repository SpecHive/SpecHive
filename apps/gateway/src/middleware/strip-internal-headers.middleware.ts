import type { NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

const INTERNAL_HEADERS = ['x-user-id', 'x-organization-id', 'x-user-role', 'x-project-id'];

@Injectable()
export class StripInternalHeadersMiddleware implements NestMiddleware {
  use(req: { headers: Record<string, unknown> }, _res: unknown, next: () => void) {
    for (const header of INTERNAL_HEADERS) {
      delete req.headers[header];
    }
    next();
  }
}
