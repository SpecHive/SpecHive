import { Controller, Get, SetMetadata } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { IS_PUBLIC_KEY } from '../constants';

@Controller('health')
@SkipThrottle()
@SetMetadata(IS_PUBLIC_KEY, true)
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
