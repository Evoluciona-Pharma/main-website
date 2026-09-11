'use client';

import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import { asset } from '@/lib/asset';
import { compliance, products as localProducts, type Product } from '@/lib/catalog';
import { useCatalog } from './CatalogContext';
import { QTY_MAX, QTY_MIN, requestItemFromProduct, useRequestList } from './RequestListContext';

export type DrawerItem = {
  name: string;
  cat: string;
  /** null when the pharmacy has not confirmed a presentation (MOTS-C). */
  dose: string | null;
  quantity: number;
  slug?: string;
  image?: string;
  remove: () => void;
};

/** Card width (290) + gap (12) — one card per arrow press. */
const RAIL_STEP = 302;

/** Never invent a presentation: an unconfirmed one says so (README §5). */
function presentationLabel(dose: string | null): string {
  return dose ? `${dose} sterile vial` : 'Presentation pending confirmation';
}

function thumbFor(it: DrawerItem): string {
  if (it.image) return asset(it.image);
  return asset('assets/vials/nad.jpg');
}

function hrefFor(it: DrawerItem): string {
  return it.slug ? `/products/${it.slug}` : '/shop';
}

const TrashIcon = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7 L20 7" />
    <path d="M9.5 7 V5.5 A1.5 1.5 0 0 1 11 4 h2 a1.5 1.5 0 0 1 1.5 1.5 V7" />
    <path d="M6.6 7 L7.4 19.1 A2 2 0 0 0 9.4 21 h5.2 a2 2 0 0 0 2-1.9 L17.4 7" />
    <path d="M10.4 11 V17 M13.6 11 V17" />
  </svg>
);

export function RequestListDrawer({
  open,
  count,
  list,
  onAdd,
  onQty,
  onClose,
  suggestProducts = localProducts,
}: {
  open: boolean;
  count: number;
  list: DrawerItem[];
  onAdd: (name: string) => void;
  onQty: (name: string, quantity: number) => void;
  onClose: () => void;
  suggestProducts?: Product[];
}) {
  const rail = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const headingId = useId();

  // Escape closes, and Tab is trapped inside the panel: a modal dialog whose
  // background stays reachable is worse than no dialog semantics at all,
  // because the focus ring disappears behind the overlay.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = !panel.current.contains(active);

      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Move focus into the drawer on open and hand it back to the opener on close,
  // so "Add to Request List" lands the user somewhere they can act.
  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => restoreFocusTo.current?.focus();
  }, [open]);

  // Without this the page scrolls behind the open drawer.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const step = (name: string, current: number, delta: number) => {
    const next = current + delta;
    if (next < QTY_MIN) return;
    onQty(name, Math.min(QTY_MAX, next));
  };

  const removeItem = (it: DrawerItem) => {
    it.remove();
  };

  const inList = new Set(list.map((i) => i.name));
  const suggestions = suggestProducts.filter((p) => !inList.has(p.name)).slice(0, 5);

  // Compliance copy is legally reviewed — split the canonical string rather than
  // retyping it, so only the emphasis is added.
  const [noticeLead, ...noticeRest] = compliance.drawerNotice.split(' — ');

  const scrollRail = (dir: 1 | -1) =>
    rail.current?.scrollBy({ left: dir * RAIL_STEP, behavior: 'smooth' });

  return (
    <>
      {/* Decorative: Escape and the close button are the keyboard paths out. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[39] animate-[fadeIn_0.25s_ease_both] cursor-pointer bg-[rgba(20,37,63,0.45)]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-[470px] animate-slideIn flex-col bg-white font-sans shadow-drawer"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#EAECF0] px-[26px] pb-5 pt-[22px]">
          <div className="flex items-start gap-[5px]">
            <h2 id={headingId} className="font-display text-[34px] leading-none text-navy">
              Request list
            </h2>
            <span className="pt-0.5 text-xs font-medium text-muted">{count}</span>
          </div>
          <button
            ref={closeButton}
            onClick={onClose}
            aria-label="Close request list"
            className="-m-1.5 flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-transparent text-navy transition-opacity hover:opacity-[.55] lg:m-0 lg:h-[30px] lg:w-[30px]"
          >
            ✕
          </button>
        </div>

        {/* Note */}
        <div className="px-[26px] pb-3.5 pt-4">
          <p className="text-[13.5px] leading-5 text-muted">
            <span className="font-semibold text-brand">{noticeLead}</span>
            {noticeRest.length > 0 && ` — ${noticeRest.join(' — ')}`}
          </p>
        </div>

        {/* Items — the only scrolling region */}
        <div className="min-h-[150px] flex-1 overflow-y-auto overflow-x-hidden px-[26px]">
          {list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="font-display text-2xl text-navy">Your list is empty</span>
              <span className="text-[13.5px] text-muted">
                Add formulations from the catalog to start a request.
              </span>
            </div>
          ) : (
            list.map((it) => (
              <div key={it.name} className="flex gap-4 border-b border-[#F0F1F4] py-[18px]">
                <Link
                  href={hrefFor(it)}
                  onClick={onClose}
                  className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-lg bg-[#F2F3F5]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbFor(it)}
                    alt={`${it.name} sterile vial`}
                    className="h-full w-full object-cover mix-blend-multiply"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        href={hrefFor(it)}
                        onClick={onClose}
                        className="text-[15px] font-semibold text-navy no-underline hover:text-brand"
                      >
                        {it.name}
                      </Link>
                      <span className="text-[13px] text-muted-2">{presentationLabel(it.dose)}</span>
                    </div>
                    {/* Where a store would price the line — deliberately price-free. */}
                    <span className="max-w-[130px] shrink-0 text-right text-meta text-muted-2">
                      {it.cat}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex h-9 items-center rounded-lg border border-[#E1E4EA]">
                      {/* At 1 the next step down would be 0, so the control becomes
                          the delete affordance rather than a dead button. */}
                      <button
                        onClick={() =>
                          it.quantity <= QTY_MIN ? removeItem(it) : step(it.name, it.quantity, -1)
                        }
                        aria-label={
                          it.quantity <= QTY_MIN
                            ? `Remove ${it.name} from request list`
                            : `Decrease ${it.name} quantity`
                        }
                        className={`flex h-[34px] w-9 cursor-pointer items-center justify-center border-none bg-transparent hover:bg-[#F5F6F8] ${
                          it.quantity <= QTY_MIN ? 'text-muted hover:text-danger' : 'text-navy'
                        }`}
                      >
                        {it.quantity <= QTY_MIN ? TrashIcon : '−'}
                      </button>
                      <span className="min-w-[26px] text-center text-sm text-navy">{it.quantity}</span>
                      <button
                        onClick={() => step(it.name, it.quantity, 1)}
                        aria-label={`Increase ${it.name} quantity`}
                        className="h-[34px] w-9 cursor-pointer border-none bg-transparent text-navy hover:bg-[#F5F6F8]"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(it)}
                      className="cursor-pointer border-none bg-transparent text-[13px] text-muted underline [text-underline-offset:3px] hover:text-danger"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-[#F1F2F4] pb-[22px] pt-5">
            <div className="flex items-center justify-between gap-3 px-[26px] pb-3.5">
              <span className="font-display text-[22px] text-navy">Frequently requested together</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => scrollRail(-1)}
                  aria-label="Previous suggestions"
                  className="h-7 w-7 cursor-pointer border-none bg-transparent text-muted hover:text-navy"
                >
                  ‹
                </button>
                <button
                  onClick={() => scrollRail(1)}
                  aria-label="More suggestions"
                  className="h-7 w-7 cursor-pointer border-none bg-transparent text-muted hover:text-navy"
                >
                  ›
                </button>
              </div>
            </div>
            <div
              ref={rail}
              className="no-scrollbar flex gap-3 overflow-x-auto px-[26px] pb-0.5"
              style={{ scrollBehavior: 'smooth' }}
            >
              {suggestions.map((p) => (
                <div
                  key={p.slug}
                  className="flex w-[290px] flex-[0_0_auto] items-center gap-3 rounded-[10px] bg-white p-2.5"
                >
                  <Link
                    href={`/products/${p.slug}`}
                    onClick={onClose}
                    className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded-[7px] bg-[#F2F3F5]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset(p.image)}
                      alt={`${p.name} sterile vial`}
                      className="h-full w-full object-cover mix-blend-multiply"
                    />
                  </Link>
                  <Link
                    href={`/products/${p.slug}`}
                    onClick={onClose}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 no-underline"
                  >
                    <span className="truncate text-sm font-semibold text-navy">{p.name}</span>
                    <span className="truncate text-[12.5px] text-muted">
                      {presentationLabel(p.defaultPresentation)}
                    </span>
                  </Link>
                  <button
                    onClick={() => onAdd(p.name)}
                    aria-label={`Add ${p.name} to request list`}
                    className="flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-brand-tint text-lg text-brand transition-colors hover:bg-brand hover:text-white"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-2.5 border-t border-[#EAECF0] px-[26px] pb-[max(22px,env(safe-area-inset-bottom))] pt-[18px]">
          <Link
            href="/request/contact"
            onClick={onClose}
            className="flex h-[50px] w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-white no-underline hover:bg-brand-hover hover:text-white"
          >
            Request Product Information
          </Link>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-[13px] font-semibold text-navy underline"
          >
            Continue browsing
          </button>
        </div>
      </div>
    </>
  );
}

/** Context-connected wrapper: the drawer itself stays presentational. */
export default function RequestDrawer() {
  const { items, count, drawerOpen, add, setQuantity, remove, closeDrawer } = useRequestList();
  const { products: catalogProducts } = useCatalog();
  const suggestProducts = catalogProducts.length ? catalogProducts : localProducts;

  const list: DrawerItem[] = items.map((i) => ({
    name: i.name,
    cat: i.program,
    dose: i.presentation,
    quantity: i.quantity,
    slug: i.slug,
    image: i.image,
    remove: () => remove(i.name),
  }));

  const onAdd = (name: string) => {
    const product = suggestProducts.find((p) => p.name === name);
    if (product) add(requestItemFromProduct(product));
  };

  return (
    <RequestListDrawer
      open={drawerOpen}
      count={count}
      list={list}
      onAdd={onAdd}
      onQty={setQuantity}
      onClose={closeDrawer}
      suggestProducts={suggestProducts}
    />
  );
}
