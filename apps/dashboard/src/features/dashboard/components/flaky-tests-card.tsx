import { CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { FlakyTestSummary, OrganizationFlakyTestSummary } from '@/types/api';

interface FlakyTestsCardProps {
  flakyTests: FlakyTestSummary[] | OrganizationFlakyTestSummary[] | null;
  isOrgView: boolean;
  loading: boolean;
}

export function FlakyTestsCard({ flakyTests, isOrgView, loading }: FlakyTestsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Flaky Tests</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] animate-pulse rounded bg-muted" />
        ) : flakyTests && flakyTests.length > 0 ? (
          <div className="space-y-3">
            {flakyTests.map((test, idx) => (
              <div
                key={`${test.testName}-${'projectId' in test ? test.projectId : idx}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div className="mr-4 min-w-0">
                  <span className="truncate font-medium">{test.testName}</span>
                  {isOrgView && 'projectName' in test && (
                    <span className="ml-2 text-xs text-muted-foreground">({test.projectName})</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {test.flakyCount} flaky
                  </span>
                  {'flakyCountDelta' in test &&
                    test.flakyCountDelta != null &&
                    test.flakyCountDelta > 0 && (
                      <TrendingUp className="h-3 w-3 text-red-500" aria-hidden="true" />
                    )}
                  {'flakyCountDelta' in test &&
                    test.flakyCountDelta != null &&
                    test.flakyCountDelta < 0 && (
                      <TrendingDown className="h-3 w-3 text-green-500" aria-hidden="true" />
                    )}
                  {test.avgRetries > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      avg {test.avgRetries.toFixed(1)} retries
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {(test.totalRuns > 0 ? (test.flakyCount / test.totalRuns) * 100 : 0).toFixed(1)}
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <CheckCircle className="h-8 w-8" />
            <p>No flaky tests detected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
