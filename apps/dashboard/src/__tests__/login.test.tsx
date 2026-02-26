import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { LoginPage } from '@/pages/login';

describe('LoginPage', () => {
  it('renders the email input', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders the password input', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders the sign in button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the sign in button as disabled', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('renders the Assertly card title', () => {
    render(<LoginPage />);
    expect(screen.getByText('Assertly')).toBeInTheDocument();
  });

  it('renders the sign in description', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
  });
});
