import type { Metadata } from 'next';
import ProductRoute from '@/components/product/ProductRoute';
import { productBySlug, products } from '@/lib/catalog';

const API_SEED_SLUGS = ['nad-plus', 'mots-c'];

export function generateStaticParams() {
  return [...new Set([...API_SEED_SLUGS, ...products.map((p) => p.slug)])].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = productBySlug(slug);
  const titleName = product?.name ?? slug.replace(/-/g, ' ');
  return { title: `${titleName} — Evoluciona Pharma` };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductRoute slug={slug} />;
}
