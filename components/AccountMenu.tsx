'use client';

import { FormEvent, useEffect, useId, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { TextField } from '@/components/request/fields';
import { useAuth } from './AuthContext';

export default function AccountMenu() {
  const { token, user, loginOpen, openLogin, closeLogin, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const headingId = useId();

  useEffect(() => {
    if (!loginOpen) {
      setError('');
      setPassword('');
    }
  }, [loginOpen]);

  const toggle = () => {
    if (loginOpen) closeLogin();
    else openLogin();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await login(email.trim(), password);
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Check your email and password.');
    } finally {
      setPending(false);
    }
  };

  const signedIn = Boolean(token && user);

  return (
    <div data-account-root className="relative">
      <button
        type="button"
        aria-label={signedIn ? 'Account menu' : 'Sign in'}
        aria-expanded={loginOpen}
        aria-haspopup="dialog"
        onClick={toggle}
        className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-[20px] border-none bg-transparent hover:bg-brand-tint lg:flex"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#14253F" strokeWidth="1.8" strokeLinecap="round" className="shrink-0">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.8 20 C5.6 16.4 8.4 14.4 12 14.4 C15.6 14.4 18.4 16.4 19.2 20" />
        </svg>
      </button>

      {loginOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          className="absolute right-0 top-[52px] z-[80] w-[320px] animate-fadeIn rounded-2xl border border-line bg-white p-5 shadow-menu"
        >
          {signedIn ? (
            <div className="flex flex-col gap-3">
              <span id={headingId} className="font-display text-xl text-navy">
                Account
              </span>
              <span className="truncate text-sm text-ink-600">{user?.email}</span>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-1 flex h-11 cursor-pointer items-center justify-center rounded-full border-none bg-brand font-sans text-[13px] font-semibold text-white hover:bg-brand-hover"
              >
                Sign out
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3.5">
              <span id={headingId} className="font-display text-xl text-navy">
                Provider sign in
              </span>
              <span className="text-[13px] leading-5 text-muted">
                A licensed-provider account is required to browse the catalog.
              </span>
              {error && <span className="text-xs text-danger">{error}</span>}
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={setEmail}
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={setPassword}
              />
              <button
                type="submit"
                disabled={pending}
                className="mt-1 flex h-11 cursor-pointer items-center justify-center rounded-full border-none bg-brand font-sans text-[13px] font-semibold text-white hover:bg-brand-hover disabled:cursor-wait disabled:opacity-70"
              >
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
