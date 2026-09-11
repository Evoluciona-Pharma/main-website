import type { ApiEnvelope } from './types';

export class ApiError extends Error {
  status: number;
  errors?: unknown;

  constructor(message: string, status: number, errors?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export async function apiFetch<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    token?: string | null;
  } = {},
): Promise<T> {
  const { method = 'GET', body, token } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'omit',
  });

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.ok ? 'Unexpected empty response' : `Request failed (${res.status})`, res.status);
  }

  if (!json || json.success !== true) {
    throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json && 'errors' in json ? json.errors : undefined);
  }

  return json.data;
}

export function asList<T>(data: T[] | { items?: T[]; products?: T[]; categories?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.products)) return data.products;
  if (data && Array.isArray(data.categories)) return data.categories;
  return [];
}
