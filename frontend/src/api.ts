// All backend calls go through here, so the API shape lives in one place.
// Keep these types in sync with the Pydantic models in backend/app/routes.

export type Item = { id: number; name: string; done: boolean };

// ---- Records (backend/app/records.py) ----
// A package of the owner's records for a date range. Shared links and
// exports both use it; loan coaching can read cash_flow from it too.

export type Tier = "verified" | "matched" | "corroborated" | "self_reported";
export type EntryKind = "sale" | "expense" | "utang" | "utang_paid";
export type Section = "profile" | "cash_flow" | "monthly" | "receivables" | "entries";

export type StoreProfile = {
  store_name: string;
  business_type: string;
  city: string;
  operating_since: number;
};

export type CashFlow = {
  income: number;
  expenses: number;
  profit: number;
  income_by_tier: Record<Tier, number>; // whole percent
  days_in_range: number;
  days_logged: number;
  late_entry_percent: number;
};

export type Month = { month: string; income: number; expenses: number; profit: number };

// Utang owed to the store, by age. Totals only, never who owes it.
export type Receivables = {
  outstanding: number;
  customers_owing: number;
  age_0_30: number;
  age_31_60: number;
  age_over_60: number;
};

export type RecordEntry = {
  sale_date: string;
  kind: EntryKind;
  amount: number;
  tier: Tier;
  late: boolean;
};

// Never includes customer names or notes.
export type RecordsPackage = {
  date_from: string;
  date_to: string;
  sections: Section[];
  profile: StoreProfile | null;
  cash_flow: CashFlow | null;
  monthly: Month[] | null;
  receivables: Receivables | null;
  entries: RecordEntry[] | null;
};

// ---- Sharing (backend/app/routes/shares.py) ----

export type ShareIn = {
  lender_name: string;
  purpose: string;
  date_from: string; // YYYY-MM-DD
  date_to: string;
  sections?: Section[]; // default: profile + cash_flow
  expires_in_days: 7 | 14 | 30;
};

// Everything a lender sees through a link.
export type LenderView = {
  lender_name: string;
  purpose: string;
  shared_at: string;
  expires_at: string;
  csv_available: boolean;
  records: RecordsPackage;
};

export type Share = {
  id: string;
  lender_name: string;
  purpose: string;
  date_from: string;
  date_to: string;
  sections: Section[];
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  status: "active" | "expired" | "revoked";
  view_count: number;
  last_viewed_at: string | null;
};

// The token is only returned once, right after creating the share.
export type ShareCreated = Share & { token: string; link: string };

export type ShareView = {
  viewed_at: string;
  device: string;
  action: "opened" | "downloaded CSV";
};

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

  // CSV downloads: use these as link hrefs so the browser saves the file.
  sharedCsvUrl: (token: string) => `/api/shared/${encodeURIComponent(token)}/entries.csv`,
  exportCsvUrl: (dateFrom: string, dateTo: string) =>
    `/api/exports/entries.csv?date_from=${dateFrom}&date_to=${dateTo}`,
};
