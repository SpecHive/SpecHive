/**
 * Compile-time test: branded ID types must be mutually incompatible.
 * This file has no runtime assertions — it is verified by `tsc --noEmit`.
 */

import { asOrganizationId, asProjectId } from '../ids.js';
import type { OrganizationId, ProjectId } from '../ids.js';

const orgId: OrganizationId = asOrganizationId('test');
// @ts-expect-error — OrganizationId should not be assignable to ProjectId
const projectId: ProjectId = orgId;

const projId: ProjectId = asProjectId('test');
// @ts-expect-error — ProjectId should not be assignable to OrganizationId
const orgId2: OrganizationId = projId;

// Suppress unused-variable warnings — this file is only for type checking
void projectId;
void orgId2;
