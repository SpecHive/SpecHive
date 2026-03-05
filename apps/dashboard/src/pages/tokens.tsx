import { Copy, Key, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Form, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { formatDateTime, formatRelativeTime } from '@/lib/formatters';
import { useProject } from '@/lib/project-context';
import type { TokenCreatedResponse, TokenListItem, TokenListResponse } from '@/types/api';

export function TokensPage() {
  const { selectedProjectId: projectId } = useProject();
  const [page, setPage] = useState(1);

  const {
    data: tokensData,
    loading,
    refetch,
  } = useApi<TokenListResponse>(projectId ? `/v1/projects/${projectId}/tokens` : null, {
    page: String(page),
    pageSize: '20',
    includeRevoked: 'true',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<TokenCreatedResponse | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TokenListItem | null>(null);

  const tokens = tokensData?.data ?? [];
  const meta = tokensData?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tokens"
        description="Manage API tokens for sending test results."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Generate Token
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Project Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !tokensData ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Key className="h-8 w-8" />
              <p>No tokens yet. Generate one to start sending test results.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Prefix</th>
                    <th className="pb-3 pr-4">Created</th>
                    <th className="pb-3 pr-4">Last Used</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr key={token.id} className="border-b">
                      <td className="py-3 pr-4 font-medium">{token.name}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{token.tokenPrefix}...</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatRelativeTime(token.createdAt)}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {token.lastUsedAt ? formatRelativeTime(token.lastUsedAt) : 'Never'}
                      </td>
                      <td className="py-3 pr-4">
                        {token.revokedAt ? (
                          <span className="text-muted-foreground">
                            Revoked {formatDateTime(token.revokedAt)}
                          </span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">Active</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={!!token.revokedAt}
                          onClick={() => setRevokeTarget(token)}
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {meta && <Pagination meta={meta} onPageChange={setPage} />}
        </CardContent>
      </Card>

      {/* Create Token Dialog */}
      <CreateTokenDialog
        open={createOpen}
        projectId={projectId!}
        onClose={() => setCreateOpen(false)}
        onCreated={(token) => {
          setCreatedToken(token);
          refetch();
        }}
      />

      {/* Token Display Dialog */}
      <TokenDisplayDialog token={createdToken} onClose={() => setCreatedToken(null)} />

      {/* Revoke Confirmation Dialog */}
      <RevokeTokenDialog
        token={revokeTarget}
        projectId={projectId!}
        onClose={() => setRevokeTarget(null)}
        onRevoked={() => {
          setRevokeTarget(null);
          refetch();
        }}
      />
    </div>
  );
}

/* --- Create Token Dialog --- */

function CreateTokenDialog({
  open,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (token: TokenCreatedResponse) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setName('');
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Token name is required');
      return;
    }
    if (trimmed.length > 100) {
      setError('Token name must be 100 characters or less');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const token = await apiClient.post<TokenCreatedResponse>(`/v1/projects/${projectId}/tokens`, {
        name: trimmed,
      });
      handleClose();
      onCreated(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>Generate Token</DialogHeader>
      <Form onSubmit={handleSubmit}>
        <FormItem>
          <FormLabel htmlFor="token-name">Name</FormLabel>
          <Input
            id="token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CI Pipeline"
            disabled={submitting}
            autoFocus
          />
          <FormMessage>{error}</FormMessage>
        </FormItem>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Generating...' : 'Generate'}
          </Button>
        </DialogFooter>
      </Form>
    </Dialog>
  );
}

/* --- Token Display Dialog --- */

function TokenDisplayDialog({
  token,
  onClose,
}: {
  token: TokenCreatedResponse | null;
  onClose: () => void;
}) {
  async function handleCopy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token.token);
      toast.success('Copied!');
    } catch {
      toast.error('Failed to copy token');
    }
  }

  return (
    <Dialog open={!!token} onClose={onClose}>
      <DialogHeader>Token Created</DialogHeader>
      <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
        This token will only be shown once. Copy it now.
      </p>
      {token && (
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
            {token.token}
          </code>
          <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy token">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}
      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </Dialog>
  );
}

/* --- Revoke Confirmation Dialog --- */

function RevokeTokenDialog({
  token,
  projectId,
  onClose,
  onRevoked,
}: {
  token: TokenListItem | null;
  projectId: string;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleRevoke() {
    if (!token) return;
    setSubmitting(true);
    try {
      await apiClient.delete(`/v1/projects/${projectId}/tokens/${token.id}`);
      toast.success(`Token "${token.name}" revoked`);
      onRevoked();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke token');
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!token} onClose={onClose}>
      <DialogHeader onClose={onClose}>Revoke Token</DialogHeader>
      <p className="text-sm text-muted-foreground">
        Are you sure you want to revoke &ldquo;{token?.name}&rdquo;? This token will immediately
        stop working.
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleRevoke} disabled={submitting}>
          {submitting ? 'Revoking...' : 'Revoke'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
