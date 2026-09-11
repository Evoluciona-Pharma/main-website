'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/catalog';

export const QTY_MIN = 1;
export const QTY_MAX = 20;

export type RequestItem = {
  name: string;
  program: string;
  /** null when the pharmacy has not confirmed a presentation. */
  presentation: string | null;
  /** Hub catalog id — required later to POST an order line. */
  productId?: number | null;
  presentationId?: number | null;
  quantity: number;
  slug?: string;
  image?: string;
};

type RequestListValue = {
  items: RequestItem[];
  count: number;
  drawerOpen: boolean;
  add: (item: Omit<RequestItem, 'quantity'> & { quantity?: number }) => void;
  setQuantity: (name: string, quantity: number) => void;
  remove: (name: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const RequestListContext = createContext<RequestListValue | null>(null);

const STORAGE_KEY = 'evo-request-list';

function clampQty(n: number): number {
  if (!Number.isFinite(n)) return QTY_MIN;
  return Math.min(QTY_MAX, Math.max(QTY_MIN, Math.round(n)));
}

function normalizeItem(raw: unknown): RequestItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<RequestItem>;
  if (typeof row.name !== 'string' || !row.name) return null;
  return {
    name: row.name,
    program: typeof row.program === 'string' ? row.program : '',
    presentation: row.presentation ?? null,
    productId: typeof row.productId === 'number' ? row.productId : null,
    presentationId: typeof row.presentationId === 'number' ? row.presentationId : null,
    quantity: clampQty(typeof row.quantity === 'number' ? row.quantity : QTY_MIN),
    slug: typeof row.slug === 'string' ? row.slug : undefined,
    image: typeof row.image === 'string' ? row.image : undefined,
  };
}

export function requestItemFromProduct(
  product: Product,
  presentation: string | null = product.defaultPresentation,
  quantity = QTY_MIN,
): RequestItem {
  const presentationId =
    presentation && product.presentationIds?.[presentation] != null
      ? product.presentationIds[presentation]
      : null;
  return {
    name: product.name,
    program: product.program,
    presentation,
    productId: product.apiId ?? null,
    presentationId,
    quantity: clampQty(quantity),
    slug: product.slug,
    image: product.image,
  };
}

export function RequestListProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hydrated = useRef(false);
  // Adding an item was previously silent for screen-reader users — the drawer
  // slides in and the nav badge ticks up, neither of which is announced. The
  // message is staged here and completed with the new count in an effect, so
  // the state updater itself stays pure.
  const [announcement, setAnnouncement] = useState('');
  const pendingAnnouncement = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(parsed.map(normalizeItem).filter((item): item is RequestItem => item !== null));
        }
      }
    } catch {
      /* corrupted storage — start empty */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items]);

  useEffect(() => {
    if (pendingAnnouncement.current === null) return;
    const message = pendingAnnouncement.current;
    pendingAnnouncement.current = null;
    setAnnouncement(`${message} ${items.length} ${items.length === 1 ? 'item' : 'items'} in list.`);
  }, [items]);

  const add = useCallback((item: Omit<RequestItem, 'quantity'> & { quantity?: number }) => {
    const next: RequestItem = {
      ...item,
      quantity: clampQty(item.quantity ?? QTY_MIN),
      productId: item.productId ?? null,
      presentationId: item.presentationId ?? null,
    };
    setItems((prev) => {
      const existing = prev.find((i) => i.name === next.name);
      pendingAnnouncement.current = existing
        ? `${next.name} updated in your request list.`
        : `${next.name} added to your request list.`;
      if (existing) {
        // Never duplicate — re-adding updates presentation / ids and keeps qty
        // unless the caller passed one.
        return prev.map((i) =>
          i.name === next.name
            ? {
                ...i,
                ...next,
                quantity: item.quantity != null ? next.quantity : i.quantity,
                productId: next.productId ?? i.productId,
                presentationId: next.presentationId ?? i.presentationId,
              }
            : i,
        );
      }
      return [...prev, next];
    });
    setDrawerOpen(true);
  }, []);

  const setQuantity = useCallback((name: string, quantity: number) => {
    const qty = clampQty(quantity);
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, quantity: qty } : i)));
  }, []);

  const remove = useCallback((name: string) => {
    pendingAnnouncement.current = `${name} removed from your request list.`;
    setItems((prev) => prev.filter((i) => i.name !== name));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <RequestListContext.Provider
      value={{ items, count: items.length, drawerOpen, add, setQuantity, remove, clear, openDrawer, closeDrawer }}
    >
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </RequestListContext.Provider>
  );
}

export function useRequestList(): RequestListValue {
  const ctx = useContext(RequestListContext);
  if (!ctx) throw new Error('useRequestList must be used inside RequestListProvider');
  return ctx;
}
