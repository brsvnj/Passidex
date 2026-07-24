/**
 * Passidex API client. Talks to the NestJS backend. Multi-tenant context is
 * carried via the X-Org-Id header (Phase 1 stand-in for real auth).
 */
import type { CategoryDefinition } from "@passidex/schema";

export type FieldStatus =
  | "MISSING"
  | "REQUESTED"
  | "RECEIVED_PENDING"
  | "CONFIRMED";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** For Phase 1 the active org id is kept in localStorage; auth replaces this. */
export function getOrgId(): string | null {
  return localStorage.getItem("passidex:orgId");
}
export function setOrgId(id: string): void {
  localStorage.setItem("passidex:orgId", id);
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const orgId = getOrgId();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(orgId ? { "X-Org-Id": orgId } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface Completeness {
  requiredTotal: number;
  requiredConfirmed: number;
  score: number;
  pending: number;
  needsReview: number;
}

export interface Product {
  id: string;
  name: string;
  brand?: string | null;
  categoryKey: string;
  passportCode: string;
  gtin?: string | null;
  completeness?: Completeness;
}

export interface FieldValue {
  id: string;
  fieldKey: string;
  value: unknown;
  status: FieldStatus;
  needsReview: boolean;
  confidence: number | null;
}

export interface ProductDetail extends Product {
  fieldValues: FieldValue[];
  components: { id: string; name: string; supplier?: { name: string } | null }[];
  completeness: Completeness;
}

export interface Organization {
  id: string;
  name: string;
}

export const api = {
  // schema
  categories: () =>
    req<{ version: string; categories: CategoryDefinition[] }>("/schema/categories"),

  // organizations (bootstrap)
  listOrgs: () => req<Organization[]>("/organizations"),
  createOrg: (name: string) =>
    req<Organization>("/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  // products
  listProducts: () => req<Product[]>("/products"),
  getProduct: (id: string) => req<ProductDetail>(`/products/${id}`),
  createProduct: (input: {
    name: string;
    brand?: string;
    categoryKey: string;
    gtin?: string;
  }) =>
    req<Product>("/products", { method: "POST", body: JSON.stringify(input) }),
  deleteProduct: (id: string) =>
    req<void>(`/products/${id}`, { method: "DELETE" }),

  // field-value lifecycle
  pendingFields: () => req<FieldValue[]>("/field-values/pending"),
  confirmField: (id: string, value?: unknown) =>
    req<FieldValue>(`/field-values/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify(value === undefined ? {} : { value }),
    }),
  rejectField: (id: string) =>
    req<FieldValue>(`/field-values/${id}/reject`, { method: "POST", body: "{}" }),
  manualSetField: (id: string, value: unknown) =>
    req<FieldValue>(`/field-values/${id}/manual`, {
      method: "POST",
      body: JSON.stringify({ value }),
    }),

  // dashboard
  summary: () =>
    req<{
      productsTotal: number;
      complete: number;
      partial: number;
      empty: number;
      pendingReview: number;
      awaitingConfirmation: number;
      topBottlenecks: { productId: string; name: string; score: number }[];
    }>("/dashboard/summary"),
};
