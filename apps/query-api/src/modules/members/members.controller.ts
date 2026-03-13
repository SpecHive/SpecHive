import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import { z } from 'zod';

import { paginationSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { MembersService } from './members.service';

@Controller('v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  async list(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(paginationSchema)) query: z.infer<typeof paginationSchema>,
  ) {
    return this.membersService.listMembers(user.organizationId, query);
  }
}
