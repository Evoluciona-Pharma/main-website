'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCatalogCategories, fetchCatalogProduct, fetchCatalogProducts } from '@/lib/api/catalog';
import { ApiError } from '@/lib/api/client';
import type { Product, Program } from '@/lib/catalog';
import { mapApiProduct, mergeDetail, programsFromCategories } from '@/lib/catalogMap';
import { useAuth } from './AuthContext';

type CatalogValue = {
  loading: boolean;
  error: string | null;
  products: Product[];
  programs: Program[];
  refresh: () => Promise<void>;
  productBySlug: (slug: string) => Product | undefined;
  loadDetail: (product: Product) => Promise<Product>;
};

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { ready, token, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const refresh = useCallback(async () => {
    if (!token) {
      setProducts([]);
      setPrograms([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [apiProducts, apiCategories] = await Promise.all([
        fetchCatalogProducts(token),
        fetchCatalogCategories(token).catch(() => []),
      ]);
      const mapped = apiProducts.map(mapApiProduct);
      setProducts(mapped);
      setPrograms(programsFromCategories(apiCategories, mapped));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        setError('Your session expired. Sign in again to load the catalog.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not load the catalog.');
      }
      setProducts([]);
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  const productBySlug = useCallback((slug: string) => products.find((p) => p.slug === slug), [products]);

  const loadDetail = useCallback(
    async (product: Product) => {
      if (!token || product.apiId == null) return product;
      const detail = await fetchCatalogProduct(token, product.apiId);
      const merged = mergeDetail(product, detail);
      setProducts((prev) => prev.map((p) => (p.slug === merged.slug ? merged : p)));
      return merged;
    },
    [token],
  );

  const value = useMemo<CatalogValue>(
    () => ({ loading, error, products, programs, refresh, productBySlug, loadDetail }),
    [loading, error, products, programs, refresh, productBySlug, loadDetail],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
