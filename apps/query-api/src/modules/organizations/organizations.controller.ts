import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { OrganizationsService } from './organizations.service';

@Controller('v1/organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async list(@CurrentUser() user: UserContext) {
    const orgs = await this.organizationsService.getOrganizations(user.userId);
    return { data: orgs };
  }
}
