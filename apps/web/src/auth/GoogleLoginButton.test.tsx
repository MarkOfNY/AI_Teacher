import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { GoogleLoginButton } from './GoogleLoginButton';

const googleOAuth = vi.hoisted(() => ({
  login: vi.fn(),
  options: null as null | { onSuccess: (tokenResponse: { access_token?: string }) => void },
}));

vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: (options: { onSuccess: (tokenResponse: { access_token?: string }) => void }) => {
    googleOAuth.options = options;
    return googleOAuth.login;
  },
}));

describe('GoogleLoginButton', () => {
  beforeEach(() => {
    googleOAuth.login.mockClear();
    googleOAuth.options = null;
  });

  it('renders standard login with Google wording', () => {
    render(<GoogleLoginButton onCredential={vi.fn()} />);
    expect(screen.getByRole('button', { name: /login with google/i })).toBeInTheDocument();
  });

  it('starts the Google OAuth flow instead of issuing a local demo credential', async () => {
    const onCredential = vi.fn();

    render(<GoogleLoginButton onCredential={onCredential} />);
    await userEvent.click(screen.getByRole('button', { name: /login with google/i }));

    expect(googleOAuth.login).toHaveBeenCalledOnce();
    expect(onCredential).not.toHaveBeenCalled();
  });

  it('passes the Google access token to the app after a successful sign in', () => {
    const onCredential = vi.fn();

    render(<GoogleLoginButton onCredential={onCredential} />);
    googleOAuth.options?.onSuccess({ access_token: 'google-access-token' });

    expect(onCredential).toHaveBeenCalledWith('google-access-token');
  });
});
