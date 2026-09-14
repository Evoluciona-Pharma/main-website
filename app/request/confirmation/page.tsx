'use client';

import Link from 'next/link';
import { asset } from '@/lib/asset';
import { confirmationSteps, productByName } from '@/lib/catalog';
import Reveal from '@/components/Reveal';
import { useWizard } from '@/components/request/RequestWizardContext';

export default function ConfirmationPage() {
  const { submitted } = useWizard();
  const items = submitted?.items ?? [];
  const reference = submitted?.reference ?? 'REQ-2026-0418';

  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="flex justify-center px-4 pb-[104px] pt-[84px] sm:px-6">
        <Reveal className="flex w-full max-w-[680px] flex-col items-center gap-[18px]">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[36px] bg-teal-tint">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#1B8B8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5 L11 15.5 L16 9.5" />
            </svg>
          </div>
          <h2 className="text-center text-4xl leading-none text-navy lg:text-5xl">Request received</h2>
          <p className="text-center text-body-lg text-ink-500">
            An Evoluciona Pharma representative will follow up with the next steps.
            <br />
            Reference <span className="font-mono text-[15px] text-navy">{reference}</span>
          </p>

          <div className="mt-2 flex w-full flex-col gap-1 rounded-2xl border border-line p-6">
            <span className="pb-2 text-xs font-semibold tracking-[0.1em] text-muted-2">YOUR REQUEST</span>
            {items.map((it) => (
              <div key={it.name} className="flex items-center gap-3 border-t border-line-softest py-[13px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(it.image || (productByName(it.name)?.image ?? 'assets/vials/nad.jpg'))}
                  alt={`${it.name} sterile vial`}
                  className="h-[54px] w-[54px] shrink-0 rounded-[10px] border border-line bg-white object-cover"
                />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-display text-lg text-navy">{it.name}</span>
                  <span className="text-xs text-muted-2">
                    {it.program} · {it.presentation ?? 'presentation pending'}
                    {it.quantity > 1 ? ` · qty ${it.quantity}` : ''}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2.5 border-t border-line-softest pt-4">
              <span className="text-xs font-semibold tracking-[0.1em] text-muted-2">WHAT HAPPENS NEXT</span>
              {confirmationSteps.map((step, i) => (
                <div key={step} className="flex items-center gap-2.5">
                  <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[11px] bg-brand-tint text-meta-xs font-bold text-brand">
                    {i + 1}
                  </span>
                  <span className="text-body-sm text-ink-600">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1.5">
            <Link
              href="/shop"
              className="inline-flex h-12 items-center rounded-full bg-brand px-[26px] font-sans text-sm font-semibold text-white no-underline hover:bg-brand-hover hover:text-white"
            >
              Back to catalog
            </Link>
            <Link
              href="/faq"
              className="inline-flex h-12 items-center rounded-full border border-line-strongest bg-white px-6 font-sans text-sm font-semibold text-navy no-underline hover:border-brand hover:text-brand"
            >
              Provider FAQ
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
