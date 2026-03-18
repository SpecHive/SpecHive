import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogFooter, DialogHeader } from '@/shared/components/ui/dialog';
import { apiClient } from '@/shared/lib/api-client';
import type { TokenListItem } from '@/types/api';

export function RevokeTokenDialog({
  token,
  onClose,
  onRevoked,
}: {
  token: TokenListItem | null;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleRevoke() {
    if (!token) return;
    setSubmitting(true);
    try {
      await apiClient.delete(`/v1/tokens/${token.id}`);
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
