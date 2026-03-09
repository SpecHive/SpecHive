import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export function ProfilePage() {
  const { user, organization, updateUser, logout } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setProfileError('Name is required');
      return;
    }

    setProfileLoading(true);
    try {
      await apiClient.patch('/v1/auth/profile', { name: trimmed });
      updateUser({ name: trimmed });
      toast.success('Profile updated');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword || !newPassword) {
      setPasswordError('All password fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await apiClient.post('/v1/auth/change-password', { currentPassword, newPassword });
      sessionStorage.setItem(
        'assertly_flash_message',
        'Password changed successfully. Please sign in with your new password.',
      );
      logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      if (message.toLowerCase().includes('incorrect')) {
        setPasswordError('Current password is incorrect');
      } else {
        setPasswordError(message);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Form onSubmit={handleProfileSubmit}>
            <FormItem>
              <FormLabel htmlFor="name">Name</FormLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={profileLoading}
                maxLength={100}
              />
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="email">Email</FormLabel>
              <Input id="email" value={user?.email ?? ''} disabled />
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="organization">Organization</FormLabel>
              <Input id="organization" value={organization?.name ?? ''} disabled />
            </FormItem>
            <FormMessage>{profileError}</FormMessage>
            <Button type="submit" disabled={profileLoading}>
              {profileLoading ? 'Saving…' : 'Save'}
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <Form onSubmit={handlePasswordSubmit}>
            <FormItem>
              <FormLabel htmlFor="current-password">Current Password</FormLabel>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="new-password">New Password</FormLabel>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="confirm-password">Confirm New Password</FormLabel>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </FormItem>
            <FormMessage>{passwordError}</FormMessage>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? 'Changing…' : 'Change Password'}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
