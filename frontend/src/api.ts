// All backend calls go through here, so the API shape lives in one place.
// Keep these types in sync with the Pydantic models in backend/app/routes.

export type Item = { id: number; name: string; done: boolean };

// ---- Sharing (backend/app/routes/shares.py) ----

export type Tier = "verified" | "matched" | "corroborated" | "self_reported";
export type EntryKind = "sale" | "expense" | "utang" | "utang_paid";

export type ShareIn = {
  lender_name: string;
  purpose: string;
  date_from: string; // YYYY-MM-DD
  date_to: string;
  expires_in_days: 7 | 14 | 30;
  include_entries?: boolean;
  program_id?: string | null; // set when sharing starts from a Loan tab program
};

export type Summary = {
  income: number;
  expenses: number;
  profit: number;
  utang_outstanding: number;
  income_by_tier: Record<Tier, number>; // whole percent
  days_in_range: number;
  days_logged: number;
  late_entry_percent: number;
};

export type SharedEntry = {
  sale_date: string;
  kind: EntryKind;
  amount: number;
  tier: Tier;
  late: boolean;
};

// Everything a lender sees. Never includes customer names or notes.
export type LenderView = {
  store_name: string;
  lender_name: string;
  purpose: string;
  date_from: string;
  date_to: string;
  shared_at: string;
  expires_at: string;
  summary: Summary;
  entries: SharedEntry[] | null;
};

export type Share = {
  id: string;
  lender_name: string;
  purpose: string;
  program_id: string | null;
  date_from: string;
  date_to: string;
  include_entries: boolean;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  status: "active" | "expired" | "revoked";
  view_count: number;
  last_viewed_at: string | null;
};

// The token is only returned once, right after creating the share.
export type ShareCreated = Share & { token: string; link: string };

export type ShareView = { viewed_at: string; device: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  listItems: () => request<Item[]>("/items"),
  createItem: (name: string) =>
    request<Item>("/items", { method: "POST", body: JSON.stringify({ name }) }),
  deleteItem: (id: number) => request<void>(`/items/${id}`, { method: "DELETE" }),

  previewShare: (body: ShareIn) =>
    request<LenderView>("/shares/preview", { method: "POST", body: JSON.stringify(body) }),
  createShare: (body: ShareIn) =>
    request<ShareCreated>("/shares", { method: "POST", body: JSON.stringify(body) }),
  listShares: () => request<Share[]>("/shares"),
  revokeShare: (id: string) => request<Share>(`/shares/${id}/revoke`, { method: "POST" }),
  listShareViews: (id: string) => request<ShareView[]>(`/shares/${id}/views`),
  openSharedLink: (token: string) =>
    request<LenderView>(`/shared/${encodeURIComponent(token)}`),
};
