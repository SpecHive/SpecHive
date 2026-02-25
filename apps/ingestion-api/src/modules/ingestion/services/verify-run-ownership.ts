import { runs } from '@assertly/database';
import type { Database } from '@assertly/database';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

export async function verifyRunOwnership(
  runId: RunId,
  projectId: ProjectId,
  tx: Database,
): Promise<void> {
  const [run] = await tx
    .select({ projectId: runs.projectId })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);

  if (!run || run.projectId !== projectId) {
    throw new NotFoundException(`Run ${runId} not found in project`);
  }
}
