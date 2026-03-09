import { Copy, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Form, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatRelativeTime } from '@/lib/formatters';
import type {
  InvitationCreatedResponse,
  InvitationListItem,
  InvitationListResponse,
  MemberListItem,
  MemberListResponse,
} from '@/types/api';

export function MembersPage() {
  const { role } = useAuth();
  const isAdmin = role === 'owner' || role === 'admin';
  const [membersPage, setMembersPage] = useState(1);

  const { data: membersData, loading: membersLoading } = useApi<MemberListResponse>('/v1/members', {
    page: String(membersPage),
    pageSize: '20',
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<InvitationCreatedResponse | null>(null);

  const { data: invitationsData, refetch: refetchInvitations } = useApi<InvitationListResponse>(
    '/v1/invitations',
    { status: 'pending' },
  );

  const members = membersData?.data ?? [];
  const membersMeta = membersData?.meta;
  const pendingInvitations = invitationsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Members</h2>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Invite Member
          </Button>
        )}
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading && !membersData ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Role</th>
                    <th className="pb-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member: MemberListItem) => (
                    <tr key={member.id} className="border-b">
                      <td className="py-3 pr-4 font-medium">{member.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{member.email}</td>
                      <td className="py-3 pr-4 capitalize">{member.role}</td>
                      <td className="py-3 text-muted-foreground">
                        {formatRelativeTime(member.joinedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {membersMeta && <Pagination meta={membersMeta} onPageChange={setMembersPage} />}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {isAdmin && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Role</th>
                    <th className="pb-3 pr-4">Expires</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvitations.map((inv: InvitationListItem) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-3 pr-4">{inv.email ?? 'Anyone with link'}</td>
                      <td className="py-3 pr-4 capitalize">{inv.role}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatRelativeTime(inv.expiresAt)}
                      </td>
                      <td className="py-3">
                        <RevokeButton invitationId={inv.id} onRevoked={refetchInvitations} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Invitation Dialog */}
      <CreateInvitationDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={(invite) => {
          setCreatedInvite(invite);
          refetchInvitations();
        }}
      />

      {/* Invite URL Display Dialog */}
      <InviteUrlDialog invite={createdInvite} onClose={() => setCreatedInvite(null)} />
    </div>
  );
}

/* --- Revoke Button --- */

function RevokeButton({
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

/* --- Create Invitation Dialog --- */

function CreateInvitationDialog({
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

/* --- Invite URL Display Dialog --- */

function InviteUrlDialog({
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
