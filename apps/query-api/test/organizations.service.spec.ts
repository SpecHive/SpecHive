import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { UserId } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { OrganizationsService } from '../src/modules/organizations/organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  const mockExecute = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: DATABASE_CONNECTION, useValue: { execute: mockExecute } },
      ],
    }).compile();

    service = module.get(OrganizationsService);
  });

  it('returns user organizations via SECURITY DEFINER function', async () => {
    mockExecute.mockResolvedValueOnce([
      {
        organization_id: 'org-1',
        organization_name: 'Org One',
        organization_slug: 'org-one',
        role: 'owner',
      },
      {
        organization_id: 'org-2',
        organization_name: 'Org Two',
        organization_slug: 'org-two',
        role: 'member',
      },
    ]);

    const result = await service.getOrganizations('user-1' as UserId);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'org-1',
      name: 'Org One',
      slug: 'org-one',
      role: 'owner',
    });
    expect(result[1]).toEqual({
      id: 'org-2',
      name: 'Org Two',
      slug: 'org-two',
      role: 'member',
    });
  });

  it('returns empty array when user has no organizations', async () => {
    mockExecute.mockResolvedValueOnce([]);

    const result = await service.getOrganizations('user-1' as UserId);
    expect(result).toEqual([]);
  });
});
