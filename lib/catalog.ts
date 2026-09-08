import catalog from '@/data/catalog.json';

export type Program = {
  slug: string;
  label: string;
  count: number;
  heroHue: number;
  heroTitle: string;
  heroSub: string;
  cardImage: string;
};

export type Product = {
  slug: string;
  name: string;
  program: string;
  programAlt: string | null;
  badge: string | null;
  presentations: string[];
  defaultPresentation: string | null;
  concentration: string | null;
  concentrationStatus: string;
  presentationStatus: string;
  spec: string;
  tagline: string;
  blurb: string;
  description: string;
  howSupplied: string;
  pairsWith: string;
  searchTerms: string;
  image: string;
  pendingNotice?: string;
  /** Numeric id from `GET /api/catalog/products`. Absent on local JSON products. */
  apiId?: number;
  /** Presentation label → API id, for order lines. */
  presentationIds?: Record<string, number>;
};

export type FaqBlock =
  | { type: 'h'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export type FaqQuestion = { q: string; blocks: FaqBlock[] };

export type FaqTopic = {
  slug: string;
  label: string;
  lede: string;
  questions: FaqQuestion[];
};

export const programs = catalog.programs as Program[];
export const products = catalog.products as Product[];
export const faqTopics = catalog.faqTopics as FaqTopic[];
export const compliance = catalog.compliance;
export const shopHeroAll = catalog.shopHeroAll;
export const presentationFacets = catalog.presentationFacets;
export const popularSearches = catalog.popularSearches;
export const sortOptions = catalog.sortOptions;
export const homeStats = catalog.homeStats;
export const homeHeroSlides = catalog.homeHeroSlides;
export const orderingSteps = catalog.orderingSteps;
export const portalBenefits = catalog.portalBenefits;
export const confirmationSteps = catalog.confirmationSteps;
export const productThumbViews = catalog.productThumbViews;
export const productAccordion = catalog.productAccordion;

export function programBySlug(slug: string): Program | undefined {
  return programs.find((p) => p.slug === slug);
}

export function programByLabel(label: string): Program | undefined {
  return programs.find((p) => p.label === label);
}

export function productBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function productByName(name: string): Product | undefined {
  return products.find((p) => p.name === name);
}

/** A product belongs to a program if its primary or alternate program matches. */
export function productInProgram(product: Product, programLabel: string): boolean {
  return product.program === programLabel || product.programAlt === programLabel;
}

export function faqTopicBySlug(slug: string): FaqTopic | undefined {
  return faqTopics.find((t) => t.slug === slug);
}

/** Products shown on a product page's "You may also review" rail:
    same-program products first, then the rest, capped at 4. */
export function alsoReview(product: Product, list: Product[] = products): Product[] {
  const others = list.filter((p) => p.slug !== product.slug);
  const same = others.filter((p) => productInProgram(p, product.program));
  const rest = others.filter((p) => !productInProgram(p, product.program));
  return [...same, ...rest].slice(0, 4);
}

/** Pairing card product. Pairings are stored by display name. */
export function pairedProduct(product: Product, list: Product[] = products): Product | undefined {
  if (!product.pairsWith) return undefined;
  return list.find((p) => p.name === product.pairsWith || p.slug === product.pairsWith);
}
