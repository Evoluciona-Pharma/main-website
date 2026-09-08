'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/asset';
import { compliance, popularSearches, programs } from '@/lib/catalog';
import { navSearch, SearchHit } from '@/lib/search';
import AccountMenu from './AccountMenu';
import { useAuth } from './AuthContext';
import { useCatalog } from './CatalogContext';
import { useRequestList } from './RequestListContext';

type ResultCard = {
  key: string;
  kindLabel: string;
  name: string;
  meta: string;
  badge: string;
  img: string;
  isProgram: boolean;
  href: string;
};

function toCard(hit: SearchHit): ResultCard {
  if (hit.kind === 'product') {
    const p = hit.product;
    return {
      key: `product-${p.slug}`,
      kindLabel: p.program,
      name: p.name,
      meta: p.spec.replace(/^Sterile vial · /, ''),
      badge: p.badge ?? '',
      img: p.image ? asset(p.image) : '',
      isProgram: false,
      href: `/products/${p.slug}`,
    };
  }
  const g = hit.program;
  return {
    key: `program-${g.slug}`,
    kindLabel: 'Program',
    name: g.label,
    meta: `${g.count} ${g.count === 1 ? 'formulation' : 'formulations'}`,
    badge: '',
    img: '',
    isProgram: true,
    href: `/shop?program=${g.slug}`,
  };
}

const arrowIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M5 12 L19 12 M13 6 L19 12 L13 18" />
  </svg>
);

export default function EvoShopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { count, openDrawer } = useRequestList();
  const { token, user, openLogin, closeLogin, logout } = useAuth();
  const { products: catalogProducts, programs: catalogPrograms } = useCatalog();
  const navProducts = catalogProducts;
  const navPrograms = catalogPrograms.length ? catalogPrograms : programs;

  // The box mirrors the page's active query so the input reflects the URL.
  const urlQuery = pathname === '/shop' ? (searchParams.get('q') ?? '') : '';
  const urlQueryRef = useRef(urlQuery);
  urlQueryRef.current = urlQuery;

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(urlQuery);
  const [hi, setHi] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSynced = useRef(urlQuery);

  useEffect(() => setMounted(true), []);

  // Navigating closes the mobile sheet.
  useEffect(() => setMobileOpen(false), [pathname, searchParams]);

  // Defer the URL→input write while the input is focused; retry on blur.
  useEffect(() => {
    if (urlQuery === lastSynced.current) return;
    if (document.activeElement === inputRef.current) return;
    lastSynced.current = urlQuery;
    setQuery(urlQuery);
    setSearchOpen(false);
    setHi(-1);
  }, [urlQuery]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-programs-root]')) setMenuOpen(false);
      if (!t.closest('[data-account-root]')) closeLogin();
      if (!t.closest('[data-search-root]')) {
        setSearchOpen(false);
        setHi(-1);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      setMobileOpen(false);
      setSearchOpen(false);
      closeLogin();
      setHi(-1);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [closeLogin]);

  const trimmed = query.trim();
  const found = trimmed ? navSearch(trimmed, navProducts, navPrograms).map(toCard) : [];
  const results = trimmed ? found : navProducts.slice(0, 3).map((p) => toCard({ kind: 'product', product: p, rank: 0 }));
  const noResults = trimmed.length > 0 && found.length === 0;
  const resultsHeading = trimmed ? (found.length ? 'Results' : 'No matches') : 'Featured formulations';
  const allLabel = trimmed ? 'Search the full catalog' : 'Browse all formulations';
  const allHref = trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : '/shop';

  const closeSearch = () => {
    setSearchOpen(false);
    setHi(-1);
  };

  const pickPopular = (label: string) => {
    setQuery(label);
    lastSynced.current = label;
    setSearchOpen(true);
    setHi(-1);
    inputRef.current?.focus();
  };

  const clearQuery = () => {
    setQuery('');
    lastSynced.current = '';
    setSearchOpen(true);
    setHi(-1);
    inputRef.current?.focus();
    // The × also drops q from the URL, keeping the rest of the page state.
    if (pathname === '/shop' && searchParams.get('q') !== null) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('q');
      router.replace(next.size ? `/shop?${next}` : '/shop', { scroll: false });
    }
  };

  const submit = (index: number) => {
    const pick = index >= 0 ? results[index] : null;
    const href = pick ? pick.href : trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : '/shop';
    closeSearch();
    inputRef.current?.blur();
    router.push(href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = results.length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      setSearchOpen(true);
      setHi((h) => (h + 1 >= n ? 0 : h + 1));
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      setSearchOpen(true);
      setHi((h) => (h - 1 < 0 ? n - 1 : h - 1));
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  };

  const navLink =
    'font-sans text-[15px] font-medium text-navy no-underline hover:text-brand transition-colors';

  return (
    <header className="sticky top-0 z-30 flex shrink-0 flex-col bg-white shadow-nav">
      <div className="flex h-9 items-center justify-center gap-2.5 bg-navy px-4 lg:px-10">
        <span className="truncate font-sans text-meta-xs font-medium tracking-[0.1em] text-onDark">
          {compliance.topStrip}
        </span>
      </div>
      <div className="flex h-[76px] items-center justify-between gap-4 border-b border-line px-4 sm:px-6 lg:gap-8 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset('assets/brand/evoluciona-logo.png')} alt="Evoluciona Pharma" className="block h-[30px] w-auto shrink-0" />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          <Link href="/shop" className={navLink}>Shop All</Link>

          <div data-programs-root className="relative flex items-center">
            <button
              onClick={() => {
                setMenuOpen((v) => !v);
                setSearchOpen(false);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 font-sans text-[15px] font-medium text-navy hover:text-brand"
            >
              Programs
              <span
                className="inline-flex text-current transition-transform duration-200"
                style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="block">
                  <path d="M6 9 L12 15 L18 9" />
                </svg>
              </span>
            </button>
            {menuOpen && (
              <div className="absolute left-1/2 top-[52px] z-[60] flex w-[288px] -translate-x-1/2 animate-fadeIn flex-col gap-0.5 rounded-2xl border border-line bg-white p-2 shadow-menu">
                {navPrograms.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/shop?program=${p.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 font-sans text-body-sm font-medium text-ink-700 no-underline hover:bg-surface-alt hover:text-brand"
                  >
                    <span>{p.label}</span>
                    <span className="text-xs text-muted-3">{p.count}</span>
                  </Link>
                ))}
                <Link
                  href="/shop"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1.5 flex items-center gap-2 border-t border-line-faint px-3 pb-2.5 pt-[11px] font-sans text-[13px] font-semibold text-brand no-underline hover:text-brand-hover"
                >
                  All formulations
                  {arrowIcon}
                </Link>
              </div>
            )}
          </div>

          <a href="#" onClick={(e) => e.preventDefault()} className={navLink}>About</a>
          <Link href="/faq" className={navLink}>Provider FAQ</Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2 lg:gap-[18px]">
          <div data-search-root className="relative hidden shrink-0 lg:block">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                submit(hi);
              }}
              className="m-0 flex h-10 w-[224px] items-center gap-2 rounded-full border border-line-strong bg-white px-3.5 transition-colors duration-[180ms] hover:border-muted-3 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9BA5B7" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 L20 20" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-label="Search formulations"
                placeholder="Search formulations"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  lastSynced.current = e.target.value;
                  setSearchOpen(true);
                  setHi(-1);
                }}
                onFocus={() => {
                  setSearchOpen(true);
                  setMenuOpen(false);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    const q = urlQueryRef.current;
                    if (q !== lastSynced.current && document.activeElement !== inputRef.current) {
                      lastSynced.current = q;
                      setQuery(q);
                    }
                  }, 0);
                }}
                onKeyDown={onKey}
                className="h-6 min-w-0 flex-1 border-none bg-transparent p-0 font-sans text-[13px] text-navy outline-none placeholder:text-muted-3"
              />
              {trimmed.length > 0 && (
                <button
                  type="button"
                  onClick={clearQuery}
                  aria-label="Clear search"
                  className="flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] border-none bg-brand-tint p-0 hover:bg-[#DCE3F6]"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#14258F" strokeWidth="3.6" strokeLinecap="round">
                    <path d="M6 6 L18 18 M18 6 L6 18" />
                  </svg>
                </button>
              )}
            </form>

            {searchOpen && (
              <div className="absolute right-0 top-[50px] z-[70] flex w-[604px] animate-fadeIn flex-col gap-3.5 rounded-[20px] border border-line bg-white px-6 pb-6 pt-[22px] shadow-panel">
                <span className="font-display text-xl text-navy">Popular search</span>
                <div className="flex flex-wrap gap-[9px]">
                  {popularSearches.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => pickPopular(label)}
                      className={`inline-flex h-[34px] cursor-pointer items-center whitespace-nowrap rounded-full border border-line bg-surface-alt2 px-4 font-sans text-[13px] font-medium transition-colors duration-[180ms] hover:border-brand hover:text-brand ${
                        trimmed.toLowerCase() === label.toLowerCase() ? 'text-brand' : 'text-ink-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="mt-1 font-display text-xl text-navy">{resultsHeading}</span>
                {results.length > 0 && (
                  <div className="grid grid-cols-3 gap-3.5">
                    {results.map((r, i) => (
                      <Link
                        key={r.key}
                        href={r.href}
                        onClick={closeSearch}
                        onMouseEnter={() => setHi(i)}
                        className={`flex min-w-0 flex-col rounded-2xl border pb-3 pl-2.5 pr-2.5 pt-2.5 no-underline transition-colors duration-[180ms] ${
                          hi === i ? 'border-line-highlight bg-surface-alt' : 'border-line-faint bg-surface-alt2'
                        }`}
                      >
                        <span className="relative block h-[132px] overflow-hidden rounded-xl bg-[#F0F2F6]">
                          {r.img && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.img} alt={`${r.name} sterile vial`} className="block h-full w-full object-cover" />
                          )}
                          {r.isProgram && (
                            <span className="absolute inset-0 flex items-center justify-center bg-brand-tint">
                              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#14258F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 6.5 L20 6.5 M4 12 L20 12 M4 17.5 L14 17.5" />
                              </svg>
                            </span>
                          )}
                          {r.badge && (
                            <span className="absolute left-[9px] top-[9px] rounded-full bg-brand px-2.5 py-[5px] font-sans text-2xs font-semibold tracking-[0.04em] text-white">
                              {r.badge}
                            </span>
                          )}
                        </span>
                        <span className="flex min-w-0 flex-col gap-[3px] px-1 pb-[3px] pt-[11px]">
                          <span className="truncate font-sans text-meta text-muted-2">{r.kindLabel}</span>
                          <span className="truncate font-sans text-sm font-semibold text-navy">{r.name}</span>
                          <span className="truncate font-sans text-[12.5px] text-muted">{r.meta}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                {noResults && (
                  <div className="flex flex-col gap-[5px] px-0.5 pb-1 pt-1.5">
                    <span className="font-sans text-body-sm font-semibold text-navy">
                      No formulations match &ldquo;{trimmed}&rdquo;
                    </span>
                    <span className="font-sans text-meta-sm text-muted-2">
                      Try a program, a peptide name, or a presentation like 5 mL.
                    </span>
                  </div>
                )}
                <Link
                  href={allHref}
                  onClick={closeSearch}
                  className="mt-1 flex items-center justify-between gap-2 border-t border-line-faint px-1 pt-[13px] font-sans text-[13px] font-semibold text-brand no-underline hover:text-brand-hover"
                >
                  {allLabel}
                  {arrowIcon}
                </Link>
              </div>
            )}
          </div>

          <AccountMenu />

          <button
            aria-label="Open request list"
            onClick={openDrawer}
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[22px] border-none bg-transparent hover:bg-brand-tint lg:h-10 lg:w-10 lg:rounded-[20px]"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#14253F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M5 8 L19 8 L18 21 L6 21 Z" />
              <path d="M8.5 10.5 L8.5 6.5 C8.5 4.6 10 3 12 3 C14 3 15.5 4.6 15.5 6.5 L15.5 10.5" />
            </svg>
            <span className="absolute right-0 top-px flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-brand px-1 font-sans text-2xs font-bold text-white">
              {mounted ? count : 0}
            </span>
          </button>

          <button
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[22px] border-none bg-transparent hover:bg-brand-tint lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14253F" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              {mobileOpen ? <path d="M5 5 L19 19 M19 5 L5 19" /> : <path d="M3.5 6.5 L20.5 6.5 M3.5 12 L20.5 12 M3.5 17.5 L20.5 17.5" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100dvh-112px)] overflow-y-auto border-b border-line bg-white px-4 pb-6 pt-4 lg:hidden">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = mobileQuery.trim();
              setMobileOpen(false);
              router.push(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
            }}
            className="m-0 flex h-11 items-center gap-2 rounded-full border border-line-strong bg-white px-3.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9BA5B7" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 L20 20" />
            </svg>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search formulations"
              placeholder="Search formulations"
              value={mobileQuery}
              onChange={(e) => setMobileQuery(e.target.value)}
              className="h-6 min-w-0 flex-1 border-none bg-transparent p-0 font-sans text-[15px] text-navy outline-none placeholder:text-muted-3"
            />
          </form>

          <nav className="mt-3 flex flex-col">
            <Link href="/shop" className="flex min-h-11 items-center border-b border-line-faint py-2.5 font-sans text-[15px] font-medium text-navy no-underline">
              Shop All
            </Link>
            <span className="pb-1 pt-3.5 font-sans text-meta-xs font-semibold uppercase tracking-[0.1em] text-muted-2">
              Programs
            </span>
            {navPrograms.map((p) => (
              <Link
                key={p.slug}
                href={`/shop?program=${p.slug}`}
                className="flex min-h-11 items-center justify-between gap-3 border-b border-line-faint py-2.5 font-sans text-[15px] font-medium text-ink-700 no-underline"
              >
                <span>{p.label}</span>
                <span className="text-xs text-muted-3">{p.count}</span>
              </Link>
            ))}
            <a href="#" onClick={(e) => e.preventDefault()} className="flex min-h-11 items-center border-b border-line-faint py-2.5 font-sans text-[15px] font-medium text-navy no-underline">
              About
            </a>
            <Link href="/faq" className="flex min-h-11 items-center border-b border-line-faint py-2.5 font-sans text-[15px] font-medium text-navy no-underline">
              Provider FAQ
            </Link>
            {token && user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void logout();
                }}
                className="mt-2 flex min-h-11 cursor-pointer items-center border-none bg-transparent py-2.5 text-left font-sans text-[15px] font-medium text-navy"
              >
                Sign out · {user.email}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  openLogin();
                }}
                className="mt-2 flex min-h-11 cursor-pointer items-center border-none bg-transparent py-2.5 text-left font-sans text-[15px] font-medium text-brand"
              >
                Sign in
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
