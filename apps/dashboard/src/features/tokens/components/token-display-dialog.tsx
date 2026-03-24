import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogFooter, DialogHeader } from '@/shared/components/ui/dialog';
import type { TokenCreatedResponse } from '@/types/api';

export function TokenDisplayDialog({
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
