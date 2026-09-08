'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  portalBenefits,
  Product,
  shopHeroAll,
  sortOptions,
} from '@/lib/catalog';
import { asset } from '@/lib/asset';
import { presentationFacetsFrom, presentationSlug } from '@/lib/catalogMap';
import { filterProducts, SortId, sortProducts } from '@/lib/search';
import { peerRing, resetButton } from '@/lib/ui';
import Reveal from '@/components/Reveal';
import CatalogGate from '@/components/CatalogGate';
import { useAuth } from '@/components/AuthContext';
import { useCatalog } from '@/components/CatalogContext';
import { useRequestList } from '@/components/RequestListContext';

/** Presentation facet labels ↔ URL slugs (presentation state is URL-backed here,
    unlike the prototype where it was local only — README §6.5). */
const PRES_SLUGS: Record<string, string> = {
  '5 mL': '5-ml',
  '10 mL': '10-ml',
  'Pending confirmation': 'pending',
};

function slugForPresentation(label: string): string {
  return PRES_SLUGS[label] ?? presentationSlug(label);
}

/** Short hero art-direction slugs used by the placeholder caption. */
const HERO_SLUGS: Record<string, string> = {
  'longevity-cellular-health': 'longevity',
  'recovery-regenerative': 'recovery',
  'hormone-optimization': 'hormone',
  'nutrient-metabolic': 'nutrient',
  'metabolic-health': 'metabolic',
  'sexual-wellness': 'sexual-wellness',
};

const tick = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" />
  </svg>
);

function FacetRow({
  label,
  count,
  on,
  onToggle,
}: {
  label: string;
  count: number;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    // A real checkbox drives the row — it carries the checked state and the
    // accessible name, while the design's custom tick box is drawn beside it.
    <label className="flex cursor-pointer items-center gap-[11px] py-[5px] hover:opacity-75">
      <input type="checkbox" checked={on} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`relative h-[18px] w-[18px] shrink-0 rounded-[5px] border-[1.5px] border-line-strongest bg-white ${peerRing}`}
      >
        {on && (
          <span className="absolute -inset-[1.5px] flex items-center justify-center rounded-[5px] bg-brand">
            {tick}
          </span>
        )}
      </span>
      <span className="flex-1 text-sm leading-[19px] text-ink-700">{label}</span>
      <span className="text-xs text-muted-3">{count}</span>
    </label>
  );
}

export default function ShopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { add } = useRequestList();
  const { ready, token } = useAuth();
  const { products: catalogProducts, programs, loading, error, refresh } = useCatalog();

  const programBySlug = (slug: string) => programs.find((p) => p.slug === slug);
  const presentationFacets = presentationFacetsFrom(catalogProducts);
  const presLabelsBySlug = Object.fromEntries(
    presentationFacets.map((f) => [slugForPresentation(f.label), f.label]),
  );

  const programSlugs = (searchParams.get('program') ?? '').split(',').filter(Boolean);
  const presSlugs = (searchParams.get('presentation') ?? '').split(',').filter(Boolean);
  const query = (searchParams.get('q') ?? '').trim();
  const sort = (searchParams.get('sort') ?? 'featured') as SortId;

  const programLabels = programSlugs.map((s) => programBySlug(s)?.label).filter(Boolean) as string[];
  const presLabels = presSlugs.map((s) => presLabelsBySlug[s]).filter(Boolean);

  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-sort-root]')) setSortOpen(false);
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, []);

  const write = (next: { program?: string[]; presentation?: string[]; q?: string; sort?: string }) => {
    const params = new URLSearchParams();
    const p = next.program ?? programSlugs;
    const pr = next.presentation ?? presSlugs;
    const q = next.q ?? query;
    const s = next.sort ?? sort;
    if (p.length) params.set('program', p.join(','));
    if (pr.length) params.set('presentation', pr.join(','));
    if (q) params.set('q', q);
    if (s !== 'featured') params.set('sort', s);
    // Filter changes never scroll to top — only route changes do (README §4).
    router.push(params.size ? `/shop?${params}` : '/shop', { scroll: false });
  };

  const toggleProgram = (slug: string) =>
    write({ program: programSlugs.includes(slug) ? programSlugs.filter((s) => s !== slug) : [...programSlugs, slug] });
  const togglePres = (slug: string) =>
    write({ presentation: presSlugs.includes(slug) ? presSlugs.filter((s) => s !== slug) : [...presSlugs, slug] });
  const clearAll = () => write({ program: [], presentation: [], q: '' });

  const filtered = filterProducts({ list: catalogProducts, programLabels, presentations: presLabels, query });
  const shopProducts = sortProducts(filtered, sort);
  const n = shopProducts.length;
  const total = catalogProducts.length;
  const hasFilters = programSlugs.length > 0 || presSlugs.length > 0 || query.length > 0;

  // Hero context — title, sub, caption slug, and gradient hue per README §6.5.
  let hero: { title: string; sub: string; hue: number; slug: string };
  if (query) {
    hero = {
      title: `“${query}”`,
      sub:
        n === 0
          ? 'No formulations match this search.'
          : `${n} ${n === 1 ? 'formulation matches' : 'formulations match'} your search.`,
      hue: 262,
      slug: 'search',
    };
  } else if (programSlugs.length === 1 && programLabels.length === 1) {
    const g = programBySlug(programSlugs[0])!;
    hero = { title: g.heroTitle, sub: g.heroSub, hue: g.heroHue, slug: HERO_SLUGS[g.slug] ?? g.slug };
  } else if (!hasFilters) {
    hero = { title: shopHeroAll.title, sub: shopHeroAll.sub, hue: shopHeroAll.heroHue, slug: 'all' };
  } else {
    hero = {
      title: shopHeroAll.title,
      sub: `${n} of ${total} formulations match your selected filters.`,
      hue: shopHeroAll.heroHue,
      slug: 'all',
    };
  }

  // Re-run the hero entrance on every filter change by alternating between two
  // identical keyframe tracks so the animation restarts.
  const filterKey = JSON.stringify([programSlugs, presSlugs, query]);
  const tickRef = useRef(0);
  const prevKey = useRef(filterKey);
  if (filterKey !== prevKey.current) {
    prevKey.current = filterKey;
    tickRef.current += 1;
  }
  const heroAnim = tickRef.current % 2 ? 'hero-swap-b' : 'hero-swap-a';

  const crumbTail = query ? ' / Search' : programLabels.length === 1 ? ` / ${programLabels[0]}` : '';
  const heroCountLabel = !token
    ? 'Sign in to browse'
    : hasFilters
      ? `${n} of ${total} products`
      : `${total} ${total === 1 ? 'product' : 'products'}`;

  const chips: { label: string; remove: () => void }[] = [
    ...(query ? [{ label: `“${query}”`, remove: () => write({ q: '' }) }] : []),
    ...programSlugs
      .filter((s) => programBySlug(s))
      .map((s) => ({ label: programBySlug(s)!.label, remove: () => toggleProgram(s) })),
    ...presSlugs
      .filter((s) => presLabelsBySlug[s])
      .map((s) => ({ label: presLabelsBySlug[s], remove: () => togglePres(s) })),
  ];

  const sortLabel = sortOptions.find((o) => o.id === sort)?.label ?? 'Featured';

  const addProduct = (p: Product) =>
    add({ name: p.name, program: p.program, presentation: p.defaultPresentation });

  return (
    <div className="flex flex-col bg-white">
      {/* Hero band — striped placeholder under a hue-driven gradient tint */}
      <div className="relative h-[360px] shrink-0 overflow-hidden lg:h-[430px]">
        <div className="ph-stripe absolute inset-0" />
        <div
          className="absolute inset-0"
          style={{
            transition: 'background 0.9s ease',
            background: `linear-gradient(92deg, oklch(0.27 0.075 ${hero.hue} / 0.97) 0%, oklch(0.31 0.075 ${hero.hue} / 0.8) 45%, oklch(0.38 0.06 ${hero.hue} / 0.32) 100%)`,
          }}
        />
        <span className="absolute bottom-4 right-5 z-[2] rounded-[4px] bg-[rgba(255,255,255,0.9)] px-2 py-[3px] font-mono text-2xs text-footer-label">
          hero · {hero.slug} · awaiting art direction
        </span>
        <div className="absolute inset-0 z-[1] flex flex-col justify-center px-4 sm:px-8 lg:px-14">
          <div key={tickRef.current} className={`flex max-w-[680px] flex-col items-start gap-4 ${heroAnim}`}>
            <span className="text-[13px] text-[rgba(255,255,255,0.72)]">
              <Link href="/" className="text-[rgba(255,255,255,0.72)] no-underline hover:text-white">
                Home
              </Link>{' '}
              / <span className="font-medium text-white">Shop All</span>
              {crumbTail}
            </span>
            <h1 className="text-[40px] leading-[0.98] text-white lg:text-[64px]">{hero.title}</h1>
            <p className="max-w-[530px] text-body text-[rgba(255,255,255,0.85)]">{hero.sub}</p>
            <span className="inline-flex h-8 items-center whitespace-nowrap rounded-full border border-[rgba(255,255,255,0.45)] px-[15px] text-xs font-semibold text-white">
              {heroCountLabel}
            </span>
          </div>
        </div>
      </div>

      {!ready || (token && loading) ? (
        <div className="px-4 py-16 text-center text-sm text-muted sm:px-8 lg:px-14">Loading catalog…</div>
      ) : !token || error ? (
        <div className="px-4 py-16 sm:px-8 lg:px-14">
          <CatalogGate error={error} onRetry={error ? () => void refresh() : undefined} />
        </div>
      ) : (
      <div className="grid grid-cols-1 items-start gap-8 px-4 pb-[72px] pt-8 sm:px-8 lg:grid-cols-[264px_1fr] lg:gap-11 lg:px-14 lg:pt-11">
        {/* Filter sidebar — collapsible below lg, always expanded on desktop */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <div className="flex items-baseline justify-between gap-3">
            {/* Below lg the heading doubles as the disclosure toggle; at lg the
                panel is always open, so the heading is static there and no dead
                tab stop is left behind. */}
            <h2 className="font-display text-2xl text-navy">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls="shop-filters"
                className={`${resetButton} flex items-center gap-2 font-display text-2xl text-navy lg:hidden`}
              >
                Filter
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14253F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <path d="M6 9 L12 15 L18 9" />
                </svg>
              </button>
              <span className="hidden lg:inline">Filter</span>
            </h2>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                className={`${resetButton} text-xs font-semibold text-brand underline`}
              >
                Clear all
              </button>
            )}
          </div>
          <div id="shop-filters" className={`${filtersOpen ? 'flex flex-col gap-6' : 'hidden'} lg:contents`}>
          <div className="flex flex-col gap-2 border-t border-line pt-[18px]">
            <span className="pb-1 text-xs font-semibold tracking-[0.1em] text-muted-2">PROGRAM</span>
            {programs.map((g) => (
              <FacetRow
                key={g.slug}
                label={g.label}
                count={g.count}
                on={programSlugs.includes(g.slug)}
                onToggle={() => toggleProgram(g.slug)}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-[18px]">
            <span className="pb-1 text-xs font-semibold tracking-[0.1em] text-muted-2">PRESENTATION</span>
            {presentationFacets.map((f) => (
              <FacetRow
                key={f.label}
                label={f.label}
                count={f.count}
                on={presSlugs.includes(slugForPresentation(f.label))}
                onToggle={() => togglePres(slugForPresentation(f.label))}
              />
            ))}
          </div>
          <div className="rounded-xl border border-warn-border bg-warn-bg px-[15px] py-3.5">
            <span className="text-xs leading-[18px] text-warn-text">
              <strong>Verified providers only.</strong> Products are dispensed against a patient-specific
              prescription. No pricing is shown online.
            </span>
          </div>
          </div>
        </aside>

        <div className="flex flex-col gap-[22px]">
          {/* Toolbar — count, active chips, sort */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-navy">
                {n} {n === 1 ? 'product' : 'products'}
              </span>
              {chips.map((ch) => (
                <button
                  key={ch.label}
                  type="button"
                  onClick={ch.remove}
                  aria-label={`Remove ${ch.label} filter`}
                  className="inline-flex h-8 cursor-pointer items-center gap-[7px] rounded-full border border-brand-tintBorder bg-brand-tint px-[13px] font-sans text-xs font-semibold text-brand hover:bg-brand-tintHover"
                >
                  {ch.label}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#14258F" strokeWidth="3" strokeLinecap="round">
                    <path d="M6 6 L18 18 M18 6 L6 18" />
                  </svg>
                </button>
              ))}
            </div>
            <div data-sort-root className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                aria-expanded={sortOpen}
                aria-haspopup="listbox"
                aria-controls="shop-sort"
                className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-white px-[18px] font-sans text-[13px] font-medium text-ink-700 hover:border-muted-3"
              >
                Sort: {sortLabel}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C93A0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9 L12 15 L18 9" />
                </svg>
              </button>
              {sortOpen && (
                <div
                  id="shop-sort"
                  role="listbox"
                  aria-label="Sort formulations"
                  className="absolute right-0 top-12 z-30 flex w-[190px] animate-[fadeIn_0.18s_ease_both] flex-col rounded-[14px] border border-line bg-white p-1.5 shadow-dropdown"
                >
                  {sortOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={sort === o.id}
                      onClick={() => {
                        setSortOpen(false);
                        write({ sort: o.id });
                      }}
                      className={`${resetButton} flex items-center justify-between gap-2 rounded-[9px] px-3 py-[9px] text-[13px] hover:bg-surface-alt ${
                        sort === o.id ? 'font-semibold text-brand' : 'font-medium text-ink-700'
                      }`}
                    >
                      {o.label}
                      {sort === o.id && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#14258F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product grid */}
          {n > 0 && (
            <Reveal className="grid grid-cols-1 gap-[26px_24px] sm:grid-cols-2 lg:grid-cols-3">
              {shopProducts.map((p) => (
                // Stretched link: the name anchor's ::after covers the card so the
                // whole thing is clickable, without nesting the add button inside an
                // <a> (invalid) or swallowing the product name in a card-long label.
                <div key={p.slug} className="group relative flex flex-col gap-3.5">
                  <div className="relative h-[300px] overflow-hidden rounded-[20px] border border-line bg-white">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset(p.image)}
                        alt={`${p.name} sterile vial`}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-reveal group-hover:scale-105"
                      />
                    ) : (
                      <div className="ph-stripe absolute inset-0" />
                    )}
                    {p.badge && (
                      <span className="absolute left-3.5 top-3.5 rounded-full bg-brand px-3 py-1.5 text-meta-xs font-semibold tracking-[0.04em] text-white">
                        {p.badge}
                      </span>
                    )}
                    <span className="absolute bottom-3.5 left-1/2 inline-flex h-[34px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full bg-[rgba(255,255,255,0.95)] px-[18px] font-sans text-xs font-semibold text-navy shadow-[0_4px_14px_rgba(20,37,63,0.16)] transition-all duration-200 group-hover:bg-navy group-hover:text-white">
                      View details
                    </span>
                  </div>
                  <div className="flex flex-col gap-[7px] px-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        write({ program: [programs.find((g) => g.label === p.program)?.slug].filter(Boolean) as string[], presentation: presSlugs, q: query });
                      }}
                      aria-label={`Filter by ${p.program}`}
                      className={`${resetButton} relative z-10 self-start text-meta-xs font-semibold tracking-[0.09em] text-muted-2 hover:text-brand`}
                    >
                      {p.program.toUpperCase()}
                    </button>
                    <Link
                      href={`/products/${p.slug}`}
                      className="font-display text-[27px] leading-[1.05] text-navy no-underline after:absolute after:inset-0 after:content-[''] group-hover:text-brand"
                    >
                      {p.name}
                    </Link>
                    <span className="text-[13px] leading-[19px] text-muted">{p.spec}</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addProduct(p);
                      }}
                      className="relative z-10 mt-2 h-11 w-full cursor-pointer rounded-full border-none bg-brand font-sans text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-brand-hover"
                    >
                      Add to Request List
                    </button>
                  </div>
                </div>
              ))}
            </Reveal>
          )}

          {/* Empty state */}
          {n === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-line-strong bg-surface-alt2 px-6 py-[72px]">
              <span className="font-display text-[28px] text-navy">No formulations match</span>
              <span className="text-sm text-muted">Adjust your search or remove a filter to see the full catalog.</span>
              <button
                onClick={clearAll}
                className="mt-1.5 h-[42px] cursor-pointer rounded-full border border-line-strongest bg-white px-[22px] font-sans text-[13px] font-semibold text-navy hover:border-brand hover:text-brand"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* About the catalog */}
      <Reveal className="grid grid-cols-1 items-start gap-8 bg-surface-alt px-4 py-14 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-14 lg:px-14 lg:py-16">
        <div className="flex flex-col gap-3.5">
          <span className="text-xs font-semibold tracking-[0.12em] text-muted-2">ABOUT THE CATALOG</span>
          <h2 className="text-[28px] leading-[1.05] text-navy lg:text-[40px]">Documented exactly as the pharmacy confirms it.</h2>
        </div>
        <div className="flex flex-col gap-4 pt-1.5">
          <p className="text-body leading-[25px] text-ink-600">
            Every formulation lists its format, presentation, and concentration as confirmed by the compounding
            pharmacy — values still under review are marked pending rather than estimated. Product information is
            provided for licensed provider education and program support only, and no pricing is shown online.
          </p>
          <Link href="/faq" className="text-sm font-semibold no-underline">
            Read the Provider FAQ →
          </Link>
        </div>
      </Reveal>

      {/* How the provider portal works */}
      <Reveal delay={80} className="flex flex-col gap-11 px-4 pb-[76px] pt-16 sm:px-8 lg:px-14">
        <h2 className="text-center text-[28px] leading-[1.05] text-navy lg:text-[40px]">How the provider portal works</h2>
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {portalBenefits.map((b, i) => (
            <div key={b.title} className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-[28px] bg-brand-tint">
                {i === 0 && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14258F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3.5 C12 3.5 6.5 10 6.5 14 A5.5 5.5 0 0 0 17.5 14 C17.5 10 12 3.5 12 3.5 Z" />
                  </svg>
                )}
                {i === 1 && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14258F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M8 12.5 L11 15.5 L16.5 9.5" />
                  </svg>
                )}
                {i === 2 && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14258F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
                    <path d="M8.5 10.5 L8.5 7.5 C8.5 5.6 10 4 12 4 C14 4 15.5 5.6 15.5 7.5 L15.5 10.5" />
                  </svg>
                )}
                {i === 3 && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14258F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6 C4 4.9 4.9 4 6 4 L18 4 C19.1 4 20 4.9 20 6 L20 14 C20 15.1 19.1 16 18 16 L9 16 L5.5 19.5 L5.5 16 L6 16 C4.9 16 4 15.1 4 14 Z" />
                  </svg>
                )}
              </span>
              <span className="text-base font-semibold text-navy">{b.title}</span>
              <span className="text-[13px] leading-5 text-muted">{b.body}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
