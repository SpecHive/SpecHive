import { useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogFooter, DialogHeader } from '@/shared/components/ui/dialog';
import { Form, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { apiClient } from '@/shared/lib/api-client';
import type { InvitationCreatedResponse } from '@/types/api';

export function CreateInvitationDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (invite: InvitationCreatedResponse) => void;
}) {
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setEmail('');
    setSelectedRole('member');
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const body: { role: string; email?: string } = { role: selectedRole };
      if (email.trim()) body.email = email.trim();

      const invite = await apiClient.post<InvitationCreatedResponse>('/v1/invitations', body);
      handleClose();
      onCreated(invite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>Invite Member</DialogHeader>
      <Form onSubmit={handleSubmit}>
        <FormItem>
          <FormLabel htmlFor="invite-email">Email (optional)</FormLabel>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to create an open invite link.
          </p>
        </FormItem>
        <FormItem>
          <FormLabel htmlFor="invite-role">Role</FormLabel>
          <select
            id="invite-role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={submitting}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        </FormItem>
        <FormMessage>{error}</FormMessage>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Invitation'}
          </Button>
        </DialogFooter>
      </Form>
    </Dialog>
  );
}
