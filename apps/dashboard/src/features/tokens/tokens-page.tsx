import { Key, Plus } from 'lucide-react';
import { useState } from 'react';

import { useProject } from '@/contexts/project-context';
import { CreateTokenDialog } from '@/features/tokens/components/create-token-dialog';
import { RevokeTokenDialog } from '@/features/tokens/components/revoke-token-dialog';
import { TokenDisplayDialog } from '@/features/tokens/components/token-display-dialog';
import { PageHeader } from '@/layout/page-header';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Pagination } from '@/shared/components/ui/pagination';
import { useApi } from '@/shared/hooks/use-api';
import { formatDateTime, formatRelativeTime } from '@/shared/lib/formatters';
import type { TokenCreatedResponse, TokenListItem, TokenListResponse } from '@/types/api';

export function TokensPage() {
  const { projects, selectedProjectIds, isAllSelected } = useProject();
  const [page, setPage] = useState(1);

  const params: Record<string, string> = {
    page: String(page),
    pageSize: '20',
    includeRevoked: 'true',
  };
  if (!isAllSelected) params.projectIds = selectedProjectIds.join(',');

  const { data: tokensData, loading, refetch } = useApi<TokenListResponse>('/v1/tokens', params);

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
                    <th className="pb-3 pr-4">Project</th>
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
                      <td className="py-3 pr-4 text-muted-foreground">{token.projectName}</td>
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

      <CreateTokenDialog
        open={createOpen}
        projects={projects}
        selectedProjectIds={selectedProjectIds}
        onClose={() => setCreateOpen(false)}
        onCreated={(token) => {
          setCreatedToken(token);
          refetch();
        }}
      />

      <TokenDisplayDialog token={createdToken} onClose={() => setCreatedToken(null)} />

      <RevokeTokenDialog
        token={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onRevoked={() => {
          setRevokeTarget(null);
          refetch();
        }}
      />
    </div>
  );
}
