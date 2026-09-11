import { programs as localPrograms, type Product, type Program } from './catalog';
import type { ApiCategory, ApiContentSection, ApiProduct, ApiRelatedProduct } from './api/types';

const LOCAL_IMAGE_BY_SLUG: Record<string, string> = {
  'nad-plus': 'assets/vials/nad.jpg',
  nad: 'assets/vials/nad.jpg',
  'nad-glutathione': 'assets/vials/nad-glutathione.jpg',
  'mots-c': 'assets/vials/mots-c.jpg',
  'bpc-157': 'assets/vials/bpc-157.jpg',
  'tb-500': 'assets/vials/tb-500.jpg',
  sermorelin: 'assets/vials/sermorelin.jpg',
  'lipo-c': 'assets/vials/lipo-c.jpg',
  'pt-141': 'assets/vials/pt-141.jpg',
};

function tagText(tags: ApiProduct['tags']): string {
  if (!tags?.length) return '';
  return tags
    .map((t) => (typeof t === 'string' ? t : t.name || t.label || ''))
    .filter(Boolean)
    .join(' ');
}

function howSuppliedFrom(sections: ApiContentSection[] | undefined, fallback: string): string {
  if (!sections?.length) return fallback;
  const match = [...sections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).find((s) => {
    const type = (s.sectionType ?? '').toLowerCase();
    const title = (s.title ?? '').toLowerCase();
    return type.includes('supply') || title.includes('supplied') || title.includes('how it');
  });
  return (match?.content || fallback).trim();
}

function coverImage(api: ApiProduct): string {
  const primary = api.images?.find((img) => img.isPrimary)?.imageUrl || api.images?.[0]?.imageUrl;
  const url = api.imageUrl || primary || '';
  if (url) return url;
  return LOCAL_IMAGE_BY_SLUG[api.slug] ?? '';
}

function specLine(presentations: string[], concentration: string | null): string {
  const pres = presentations.length ? presentations.join(' and ') : 'presentation pending confirmation';
  if (concentration) return `Sterile vial · ${pres} · ${concentration}`;
  return `Sterile vial · ${pres}`;
}

export function mapApiProduct(api: ApiProduct): Product {
  const presentations = [...(api.presentations ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const labels = presentations.map((p) => p.label);
  const defaultRow = presentations.find((p) => p.isDefault) ?? presentations[0];
  const concentration = defaultRow?.concentration ?? null;
  const summary = (api.shortSummary || '').trim();
  const description = (api.description || summary).trim();
  const relatedName = api.relationsFrom?.[0]?.relatedProduct?.name ?? '';

  const presentationIds: Record<string, number> = {};
  for (const row of presentations) presentationIds[row.label] = row.id;

  return {
    slug: api.slug,
    name: api.name,
    program: api.category?.name ?? '',
    programAlt: null,
    badge: api.isFeatured ? 'Featured' : api.isNew ? 'New' : null,
    presentations: labels,
    defaultPresentation: defaultRow?.label ?? null,
    concentration,
    concentrationStatus: concentration ? 'confirmed' : 'on-label',
    presentationStatus: labels.length ? 'confirmed' : 'pending',
    spec: specLine(labels, concentration),
    tagline: summary || description,
    blurb: summary || description,
    description,
    howSupplied: howSuppliedFrom(api.contentSections, description),
    pairsWith: relatedName,
    searchTerms: [api.name, api.category?.name ?? '', labels.join(' '), tagText(api.tags), summary].join(' '),
    image: coverImage(api),
    apiId: api.id,
    presentationIds,
  };
}

export function mapRelatedToProduct(related: ApiRelatedProduct, program: string): Product {
  return {
    slug: related.slug,
    name: related.name,
    program,
    programAlt: null,
    badge: null,
    presentations: [],
    defaultPresentation: null,
    concentration: null,
    concentrationStatus: 'on-label',
    presentationStatus: related.slug ? 'confirmed' : 'pending',
    spec: 'Sterile vial',
    tagline: related.shortSummary ?? '',
    blurb: related.shortSummary ?? '',
    description: related.shortSummary ?? '',
    howSupplied: '',
    pairsWith: '',
    searchTerms: related.name,
    image: related.imageUrl || LOCAL_IMAGE_BY_SLUG[related.slug] || '',
    apiId: related.id,
  };
}

export function mergeDetail(listItem: Product, detail: ApiProduct): Product {
  const mapped = mapApiProduct(detail);
  return {
    ...listItem,
    ...mapped,
    image: mapped.image || listItem.image,
    pairsWith: mapped.pairsWith || listItem.pairsWith,
    howSupplied: mapped.howSupplied || listItem.howSupplied,
    description: mapped.description || listItem.description,
  };
}

export function programsFromCategories(categories: ApiCategory[], products: Product[]): Program[] {
  const fromApi = categories.map((c) => {
    const local = localPrograms.find((p) => p.slug === c.slug);
    return {
      slug: c.slug,
      label: c.name,
      count: products.filter((p) => p.program === c.name).length,
      heroHue: local?.heroHue ?? 262,
      heroTitle: local?.heroTitle ?? c.name,
      heroSub: local?.heroSub ?? '',
      cardImage: local?.cardImage ?? '',
    } satisfies Program;
  });

  if (fromApi.length) return fromApi;

  const byLabel = new Map<string, Program>();
  for (const p of products) {
    if (!p.program) continue;
    const slug = p.program.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const local = localPrograms.find((g) => g.label === p.program || g.slug === slug);
    const key = local?.slug ?? slug;
    const existing = byLabel.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byLabel.set(key, {
        slug: key,
        label: p.program,
        count: 1,
        heroHue: local?.heroHue ?? 262,
        heroTitle: local?.heroTitle ?? p.program,
        heroSub: local?.heroSub ?? '',
        cardImage: local?.cardImage ?? '',
      });
    }
  }
  return [...byLabel.values()];
}

export function presentationFacetsFrom(products: Product[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    if (!p.presentations.length) {
      counts.set('Pending confirmation', (counts.get('Pending confirmation') ?? 0) + 1);
      continue;
    }
    for (const label of p.presentations) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

export function presentationSlug(label: string): string {
  const known: Record<string, string> = {
    '5 mL': '5-ml',
    '10 mL': '10-ml',
    'Pending confirmation': 'pending',
  };
  if (known[label]) return known[label];
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
