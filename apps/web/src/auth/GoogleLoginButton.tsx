import { useGoogleLogin } from '@react-oauth/google';

interface GoogleLoginButtonProps {
  onCredential: (credential: string) => void;
}

export function GoogleLoginButton({ onCredential }: GoogleLoginButtonProps) {
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      onCredential(tokenResponse.access_token);
    },
    scope: 'openid email profile',
  });

  return (
    <button type="button" onClick={() => login()}>
      Login with Google
    </button>
  );
}
