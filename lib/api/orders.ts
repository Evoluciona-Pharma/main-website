import { apiFetch } from './client';
import type { CreateOrderBody, CreatedOrder } from './types';

export async function createPatientOrder(token: string, body: CreateOrderBody): Promise<CreatedOrder> {
  return apiFetch<CreatedOrder>('/api/patient/orders', {
    method: 'POST',
    token,
    body,
  });
}
