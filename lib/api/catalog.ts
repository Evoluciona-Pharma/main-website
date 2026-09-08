import { apiFetch, asList } from './client';
import type { ApiCategory, ApiProduct } from './types';

export async function fetchCatalogProducts(token: string): Promise<ApiProduct[]> {
  const data = await apiFetch<ApiProduct[] | { products?: ApiProduct[]; items?: ApiProduct[] }>(
    '/api/catalog/products',
    { token },
  );
  return asList(data);
}

export async function fetchCatalogCategories(token: string): Promise<ApiCategory[]> {
  const data = await apiFetch<ApiCategory[] | { categories?: ApiCategory[]; items?: ApiCategory[] }>(
    '/api/catalog/categories',
    { token },
  );
  return asList(data);
}

export async function fetchCatalogProduct(token: string, id: number): Promise<ApiProduct> {
  return apiFetch<ApiProduct>(`/api/catalog/products/${id}`, { token });
}
