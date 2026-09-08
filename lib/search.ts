import { Product, Program, products, programs, productInProgram } from './catalog';

/** Shop filtering — AND across the three axes; the text query is AND across
    whitespace tokens matched against name + program + presentations + spec + blurb. */
export function filterProducts(opts: {
  list?: Product[];
  programLabels?: string[];
  presentations?: string[];
  query?: string;
}): Product[] {
  const { list = products, programLabels = [], presentations = [], query = '' } = opts;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  return list.filter((p) => {
    if (programLabels.length && !programLabels.some((label) => productInProgram(p, label))) {
      return false;
    }
    if (presentations.length) {
      const pending = p.presentationStatus === 'pending';
      const match = presentations.some((facet) =>
        facet === 'Pending confirmation' ? pending : p.presentations.includes(facet),
      );
      if (!match) return false;
    }
    if (tokens.length) {
      const haystack = [p.name, p.program, p.programAlt ?? '', p.presentations.join(' '), p.spec, p.blurb]
        .join(' ')
        .toLowerCase();
      if (!tokens.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });
}

export type SortId = 'featured' | 'az' | 'za';

export function sortProducts(list: Product[], sort: SortId): Product[] {
  if (sort === 'az') return [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'za') return [...list].sort((a, b) => b.name.localeCompare(a.name));
  return list;
}

/** Nav typeahead. Match is AND across whitespace tokens over name + program +
    presentation + the synonym list. Ranking: name starts with the first token (0)
    → name contains it (1) → other field (2). Max 5 formulations + 2 programs, capped at 6. */
export type SearchHit =
  | { kind: 'product'; product: Product; rank: number }
  | { kind: 'program'; program: Program; rank: number };

export function navSearch(query: string, list: Product[] = products, programList: Program[] = programs): SearchHit[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const first = tokens[0];

  const productHits: SearchHit[] = [];
  for (const p of list) {
    const fields = [p.name, p.program, p.programAlt ?? '', p.presentations.join(' '), p.searchTerms]
      .join(' ')
      .toLowerCase();
    if (!tokens.every((t) => fields.includes(t))) continue;
    const name = p.name.toLowerCase();
    const rank = name.startsWith(first) ? 0 : name.includes(first) ? 1 : 2;
    productHits.push({ kind: 'product', product: p, rank });
  }
  productHits.sort((a, b) => a.rank - b.rank);

  const programHits: SearchHit[] = [];
  for (const g of programList) {
    const label = g.label.toLowerCase();
    if (!tokens.every((t) => label.includes(t))) continue;
    const rank = label.startsWith(first) ? 0 : label.includes(first) ? 1 : 2;
    programHits.push({ kind: 'program', program: g, rank });
  }
  programHits.sort((a, b) => a.rank - b.rank);

  return [...productHits.slice(0, 5), ...programHits.slice(0, 2)].slice(0, 6);
}
