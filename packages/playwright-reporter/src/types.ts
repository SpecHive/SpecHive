import type { BaseReporterConfig } from '@spechive/reporter-client';

export interface SpecHiveReporterConfig extends BaseReporterConfig {
  captureArtifacts?: boolean;
}
