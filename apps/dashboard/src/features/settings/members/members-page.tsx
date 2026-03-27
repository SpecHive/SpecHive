import { Plus } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { CreateInvitationDialog } from '@/features/settings/members/components/create-invitation-dialog';
import { InviteUrlDialog } from '@/features/settings/members/components/invite-url-dialog';
import { RevokeButton } from '@/features/settings/members/components/revoke-button';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Pagination } from '@/shared/components/ui/pagination';
import { useApi } from '@/shared/hooks/use-api';
import { formatRelativeTime } from '@/shared/lib/formatters';
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

      <CreateInvitationDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={(invite) => {
          setCreatedInvite(invite);
          refetchInvitations();
        }}
      />

      <InviteUrlDialog invite={createdInvite} onClose={() => setCreatedInvite(null)} />
    </div>
  );
}
