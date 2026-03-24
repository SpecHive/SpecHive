import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogFooter, DialogHeader } from '@/shared/components/ui/dialog';
import type { InvitationCreatedResponse } from '@/types/api';

export function InviteUrlDialog({
  invite,
  onClose,
}: {
  invite: InvitationCreatedResponse | null;
  onClose: () => void;
}) {
  async function handleCopy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      toast.success('Copied!');
    } catch {
      toast.error('Failed to copy invite link');
    }
  }

  return (
    <Dialog open={!!invite} onClose={onClose}>
      <DialogHeader>Invitation Created</DialogHeader>
      <p className="mb-3 text-sm text-muted-foreground">
        Share this link with the person you want to invite. It expires in 7 days.
      </p>
      {invite && (
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
            {invite.inviteUrl}
          </code>
          <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy invite link">
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
