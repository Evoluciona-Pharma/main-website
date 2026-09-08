'use client';

import { useEffect, useState } from 'react';
import CatalogGate from '@/components/CatalogGate';
import { useAuth } from '@/components/AuthContext';
import { useCatalog } from '@/components/CatalogContext';
import ProductPage from '@/components/product/ProductPage';
import { alsoReview, pairedProduct, type Product } from '@/lib/catalog';

export default function ProductRoute({ slug }: { slug: string }) {
  const { ready, token } = useAuth();
  const { loading, error, products, productBySlug, loadDetail, refresh } = useCatalog();
  const [product, setProduct] = useState<Product | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const listed = productBySlug(slug);
    if (!listed) {
      setProduct(null);
      return;
    }
    setProduct(listed);
    setDetailError(null);
    void loadDetail(listed)
      .then((full) => setProduct(full))
      .catch((err) => setDetailError(err instanceof Error ? err.message : 'Could not load this formulation.'));
  }, [slug, productBySlug, loadDetail]);

  if (!ready || (token && loading && !product)) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-24">
        <span className="text-sm text-muted">Loading formulation…</span>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex flex-1 flex-col px-4 py-16 sm:px-8 lg:px-14">
        <CatalogGate error={error} onRetry={error ? () => void refresh() : undefined} />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="flex flex-1 flex-col px-4 py-16 sm:px-8 lg:px-14">
        <CatalogGate error={error} onRetry={() => void refresh()} />
      </div>
    );
  }

  if (!product && !loading) {
    return (
      <div className="flex flex-1 flex-col items-center gap-3 px-4 py-24 text-center">
        <span className="font-display text-[28px] text-navy">Formulation not found</span>
        <span className="text-sm text-muted">This product is not in the live catalog.</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-24">
        <span className="text-sm text-muted">Loading formulation…</span>
      </div>
    );
  }

  const related = alsoReview(product, products);
  const pair = pairedProduct(product, products);

  return (
    <div className="relative">
      {detailError && (
        <div className="px-4 pt-4 sm:px-8 lg:px-14">
          <span className="text-xs text-danger">{detailError}</span>
        </div>
      )}
      <ProductPage key={product.slug} product={product} related={related} pair={pair} />
    </div>
  );
}
