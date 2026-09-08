import { apiFetch } from './client';
import type { AuthUser, LoginData } from './types';

export async function loginRequest(email: string, password: string): Promise<LoginData> {
  return apiFetch<LoginData>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function logoutRequest(token: string): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST', token });
  } catch {
    /* token is cleared locally either way */
  }
}

export type { AuthUser, LoginData };
