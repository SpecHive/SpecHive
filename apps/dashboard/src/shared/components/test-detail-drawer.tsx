import { Download, ExternalLink, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { CategoryBadge } from '@/shared/components/category-badge';
import { StatusBadge } from '@/shared/components/status-badge';
import { Button } from '@/shared/components/ui/button';
import { apiClient } from '@/shared/lib/api-client';
import type { ArtifactDownloadResponse, TestDetail } from '@/types/api';

interface TestDetailDrawerProps {
  testDetail: TestDetail;
  onClose: () => void;
}

export function TestDetailDrawer({ testDetail, onClose }: TestDetailDrawerProps) {
  const [stackTraceOpen, setStackTraceOpen] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<number>(
    testDetail.attempts.length > 0
      ? testDetail.attempts[testDetail.attempts.length - 1]!.retryIndex
      : 0,
  );

  const handleDownload = useCallback(async (artifactId: string) => {
    try {
      const response = await apiClient.get<ArtifactDownloadResponse>(
        `/v1/artifacts/${artifactId}/download`,
      );
      window.open(response.url, '_blank');
    } catch {
      toast.error('Download failed');
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const hasMultipleAttempts = testDetail.attempts.length > 1;
  const currentAttempt = testDetail.attempts.find((a) => a.retryIndex === activeAttempt);
  const currentArtifacts = hasMultipleAttempts
    ? testDetail.artifacts.filter((a) => a.retryIndex === activeAttempt)
    : testDetail.artifacts;

  // For single-attempt tests, use the test-level fields; for multi-attempt, use per-attempt fields
  const source = hasMultipleAttempts ? currentAttempt : testDetail;
  const stackTrace = source?.stackTrace;
  const errorName = source?.errorName;
  const errorCategory = source?.errorCategory;
  const errorExpected = source?.errorExpected;
  const errorActual = source?.errorActual;
  const errorLocation = source?.errorLocation;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l bg-background shadow-xl">
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Test Details</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6 p-4">
            <div>
              <h3 className="font-medium">{testDetail.name}</h3>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <StatusBadge status={testDetail.status} />
                <span>{testDetail.durationMs != null ? `${testDetail.durationMs}ms` : '—'}</span>
                {testDetail.retryCount > 0 && (
                  <span className="text-muted-foreground">{testDetail.retryCount} retries</span>
                )}
              </div>
            </div>

            {hasMultipleAttempts && (
              <div className="flex gap-1 border-b" role="tablist">
                {testDetail.attempts.map((attempt) => (
                  <button
                    key={attempt.retryIndex}
                    role="tab"
                    aria-selected={activeAttempt === attempt.retryIndex}
                    onClick={() => {
                      setActiveAttempt(attempt.retryIndex);
                      setStackTraceOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                      activeAttempt === attempt.retryIndex
                        ? 'border-b-2 border-primary text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Attempt {attempt.retryIndex + 1}
                    <StatusBadge status={attempt.status} />
                  </button>
                ))}
              </div>
            )}

            {(errorName || errorCategory || stackTrace) && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {errorName && (
                    <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      {errorName}
                    </span>
                  )}
                  {errorCategory && <CategoryBadge category={errorCategory} />}
                  {errorLocation && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {errorLocation.file}:{errorLocation.line}
                      {errorLocation.column != null ? `:${errorLocation.column}` : ''}
                    </span>
                  )}
                  {testDetail.errorGroupId && (
                    <Link
                      to={`/errors?errorGroupId=${testDetail.errorGroupId}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View error group
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                {errorExpected != null && errorActual != null && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-green-500/20 bg-green-500/5 p-2">
                      <p className="mb-1 text-xs font-medium text-green-600">Expected</p>
                      <pre className="whitespace-pre-wrap break-all font-mono text-xs">
                        {errorExpected}
                      </pre>
                    </div>
                    <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2">
                      <p className="mb-1 text-xs font-medium text-destructive">Actual</p>
                      <pre className="whitespace-pre-wrap break-all font-mono text-xs">
                        {errorActual}
                      </pre>
                    </div>
                  </div>
                )}

                {stackTrace && (
                  <div>
                    <button
                      onClick={() => setStackTraceOpen(!stackTraceOpen)}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {stackTraceOpen ? 'Hide' : 'Show'} stack trace
                    </button>
                    {stackTraceOpen && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                        {stackTrace}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentArtifacts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium">Artifacts</h4>
                <div className="mt-2 space-y-2">
                  {currentArtifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="flex items-center justify-between rounded-md border p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{artifact.name}</span>
                        {artifact.sizeBytes != null && (
                          <span className="ml-2 text-muted-foreground">
                            ({(artifact.sizeBytes / 1024).toFixed(1)} KB)
                          </span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(artifact.id)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
