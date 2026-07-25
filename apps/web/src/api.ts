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

/** Thrown on 401 so the UI can show the login screen. */
export class UnauthorizedError extends Error {}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    // Session lives in an httpOnly cookie; always send credentials.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) throw new UnauthorizedError("Not authenticated");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  orgId: string;
  orgName: string;
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

export interface PendingField extends FieldValue {
  product: { id: string; name: string; categoryKey: string };
}

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string | null;
  language?: string | null;
}

export type DataRequestStatus =
  | "DRAFT"
  | "SENT"
  | "REMINDED"
  | "ANSWERED"
  | "CLOSED";

export interface DataRequest {
  id: string;
  productId: string;
  supplierId: string;
  status: DataRequestStatus;
  language: string;
  dueAt: string | null;
  reminderCount: number;
  fields: { fieldKey: string }[];
  supplier?: { id: string; name: string };
}

export const api = {
  // auth
  me: () => req<AuthUser>("/auth/me"),
  register: (input: {
    orgName: string;
    email: string;
    password: string;
    name?: string;
  }) => req<AuthUser>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (email: string, password: string) =>
    req<AuthUser>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" }),

  // team
  teamMembers: () => req<TeamMember[]>("/team"),
  teamInvitations: () => req<Invitation[]>("/team/invitations"),
  invite: (email: string, role: "member" | "admin" = "member") =>
    req<Invitation>("/team/invitations", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  revokeInvitation: (id: string) =>
    req<{ ok: boolean }>(`/team/invitations/${id}/revoke`, {
      method: "POST",
      body: "{}",
    }),
  describeInvite: (token: string) =>
    req<{ email: string; orgName: string; role: string }>(
      `/invitations/${encodeURIComponent(token)}`,
    ),
  acceptInvite: (token: string, input: { name?: string; password: string }) =>
    req<AuthUser>(`/invitations/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // schema
  categories: () =>
    req<{ version: string; categories: CategoryDefinition[] }>("/schema/categories"),

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
  exportPassport: (id: string) =>
    req<{
      gs1DigitalLink: string;
      compliance: { complete: boolean; missingRequired: string[] };
      [k: string]: unknown;
    }>(`/products/${id}/passport`),

  // field-value lifecycle
  pendingFields: () => req<PendingField[]>("/field-values/pending"),
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

  // suppliers
  listSuppliers: () => req<Supplier[]>("/suppliers"),
  createSupplier: (input: { name: string; email?: string; language?: string }) =>
    req<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(input) }),

  // data requests
  listRequests: (productId?: string) =>
    req<DataRequest[]>(
      `/data-requests${productId ? `?productId=${encodeURIComponent(productId)}` : ""}`,
    ),
  createRequest: (input: {
    productId: string;
    supplierId: string;
    fieldKeys?: string[];
    language?: string;
  }) =>
    req<DataRequest>("/data-requests", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancelRequest: (id: string) =>
    req<{ ok: boolean }>(`/data-requests/${id}/cancel`, {
      method: "POST",
      body: "{}",
    }),
  runReminders: () =>
    req<{ processed: number; sent: number }>("/data-requests/run-reminders", {
      method: "POST",
      body: "{}",
    }),

  // dashboard
  analytics: () =>
    req<{
      fieldStatus: Record<string, number>;
      requestStatus: Record<string, number>;
      overdue: number;
      suppliers: {
        supplierId: string;
        name: string;
        hasEmail: boolean;
        open: number;
        overdue: number;
        answered: number;
        avgResponseHours: number | null;
      }[];
      oldestOpenRequests: {
        requestId: string;
        productName: string;
        supplierName: string;
        status: string;
        ageDays: number;
        overdue: boolean;
      }[];
    }>("/dashboard/analytics"),
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
