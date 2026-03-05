import { ZodValidationPipe } from '@assertly/nestjs-common';
import type { ProjectId, ProjectTokenId } from '@assertly/shared-types';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import { paginationSchema, uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { TokensService } from './tokens.service';

const createTokenSchema = z.object({ name: z.string().trim().min(1).max(100) });

const tokenListSchema = paginationSchema.extend({
  includeRevoked: z.coerce.boolean().default(false),
});

@Controller('v1/projects/:id/tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Post()
  async create(
    @CurrentUser() user: UserContext,
    @Param('id', new ZodValidationPipe(uuidSchema)) projectId: ProjectId,
    @Body(new ZodValidationPipe(createTokenSchema)) body: z.infer<typeof createTokenSchema>,
  ) {
    return this.tokensService.createToken(user.organizationId, projectId, body);
  }

  @Get()
  async list(
    @CurrentUser() user: UserContext,
    @Param('id', new ZodValidationPipe(uuidSchema)) projectId: ProjectId,
    @Query(new ZodValidationPipe(tokenListSchema)) query: z.infer<typeof tokenListSchema>,
  ) {
    const { includeRevoked, ...pagination } = query;
    return this.tokensService.listTokens(
      user.organizationId,
      projectId,
      pagination,
      includeRevoked,
    );
  }

  @Delete(':tokenId')
  @HttpCode(204)
  async revoke(
    @CurrentUser() user: UserContext,
    @Param('id', new ZodValidationPipe(uuidSchema)) projectId: ProjectId,
    @Param('tokenId', new ZodValidationPipe(uuidSchema)) tokenId: ProjectTokenId,
  ) {
    await this.tokensService.revokeToken(user.organizationId, projectId, tokenId);
  }
}
