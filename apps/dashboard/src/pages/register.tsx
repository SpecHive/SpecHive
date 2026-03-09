import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { InvitationValidation } from '@/types/api';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteData, setInviteData] = useState<InvitationValidation | null>(null);

  // If authenticated and no invite token, redirect to home
  useEffect(() => {
    if (isAuthenticated && !inviteToken) {
      navigate('/');
    }
  }, [isAuthenticated, inviteToken, navigate]);

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return;

    apiClient
      .get<InvitationValidation>(`/v1/invitations/validate/${inviteToken}`)
      .then(setInviteData)
      .catch(() => setInviteData({ valid: false }))
      .finally(() => setInviteLoading(false));
  }, [inviteToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();

    if (!trimmedName || !email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (!inviteToken && !organizationName.trim()) {
      setError('Organization name is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(
        trimmedName,
        email,
        password,
        organizationName.trim(),
        inviteToken ?? undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Show message if authenticated user tries to use an invite
  if (isAuthenticated && inviteToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Already Logged In</CardTitle>
            <CardDescription>
              You&apos;re already logged in. Please log out to accept this invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            Validating invitation...
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if invite is invalid
  if (inviteToken && inviteData && !inviteData.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Invalid Invitation</CardTitle>
            <CardDescription>This invitation link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/register">
              <Button variant="outline" className="w-full">
                Register without invitation
              </Button>
            </Link>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Assertly</CardTitle>
          {inviteData?.valid ? (
            <CardDescription>
              You&apos;ve been invited to join <strong>{inviteData.organizationName}</strong>
            </CardDescription>
          ) : (
            <CardDescription>Create your account to get started</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Form onSubmit={handleSubmit}>
            <FormItem>
              <FormLabel htmlFor="name">Name</FormLabel>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="email">Email</FormLabel>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="password">Password</FormLabel>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
            </FormItem>
            <FormItem>
              <FormLabel htmlFor="confirmPassword">Confirm password</FormLabel>
              <PasswordInput
                id="confirmPassword"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </FormItem>
            {!inviteToken && (
              <FormItem>
                <FormLabel htmlFor="organizationName">Organization name</FormLabel>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="My Company"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  This is the name of your team or company.
                </p>
              </FormItem>
            )}
            <FormMessage>{error}</FormMessage>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign up'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
