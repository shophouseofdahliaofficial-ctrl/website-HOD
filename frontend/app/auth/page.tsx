import { redirect } from 'next/navigation';

/**
 * /auth - redirects to login. Use /auth/login or /auth/signup directly.
 */
export default function AuthPage() {
  redirect('/auth/login');
}
