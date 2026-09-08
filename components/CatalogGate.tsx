'use client';

import { useAuth } from './AuthContext';

export default function CatalogGate({
  error,
  onRetry,
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  const { openLogin } = useAuth();

  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-line-strong bg-surface-alt2 px-6 py-[72px] text-center">
      <span className="font-display text-[28px] text-navy">Sign in to view the catalog</span>
      <span className="max-w-[420px] text-sm text-muted">
        Formulations load from the pharmacy catalog after you sign in with a licensed-provider account.
      </span>
      {error && <span className="max-w-[420px] text-xs text-danger">{error}</span>}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={openLogin}
          className="h-[42px] cursor-pointer rounded-full border-none bg-brand px-[22px] font-sans text-[13px] font-semibold text-white hover:bg-brand-hover"
        >
          Sign in
        </button>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="h-[42px] cursor-pointer rounded-full border border-line-strongest bg-white px-[22px] font-sans text-[13px] font-semibold text-navy hover:border-brand hover:text-brand"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
