import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { apiClient } from '@/shared/lib/api-client';

export function RevokeButton({
  invitationId,
  onRevoked,
}: {
  invitationId: string;
  onRevoked: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleRevoke() {
    setSubmitting(true);
    try {
      await apiClient.delete(`/v1/invitations/${invitationId}`);
      toast.success('Invitation revoked');
      onRevoked();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={submitting}
      onClick={handleRevoke}
    >
      Revoke
    </Button>
  );
}
