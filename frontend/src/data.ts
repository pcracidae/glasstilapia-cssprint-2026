// The ledger: types, Aling Nena's sample ledger, saving to the phone, and
// every number the screens show. Everything runs in the browser so the app
// works offline; entries live in localStorage until a sync backend exists.
//
// Money rules (cash basis, see the product brief):
//   sale, payment_in, other_income        -> cash in
//   purchase, payment_out, expense        -> cash out
//   utang (sold on credit)                -> customer owes the store
//   purchase_credit (stock on credit)     -> store owes the supplier
// Amounts are whole pesos.

export type Kind =
  | "sale"
  | "utang"
  | "payment_in"
  | "purchase"
  | "purchase_credit"
  | "payment_out"
  | "expense"
  | "other_income";

export type Tier = "verified" | "matched" | "corroborated" | "self_reported";

export type LineItem = { name: string; qty: number; price: number };

export type Entry = {
  id: string;
  kind: Kind;
  amount: number;
  tier: Tier;
  saleDate: string; // YYYY-MM-DD, picked by the owner
  time: string; // HH:MM
  recordedAt: string; // ISO time the entry was made on the phone
  contact?: string;
  description?: string;
  items?: LineItem[];
  voided?: { reason: string; at: string };
  pending?: boolean; // made offline, not yet synced
};

export type Contact = {
  name: string;
  type: "customer" | "supplier";
  photo: string; // initials colour
};

export type Account = {
  storeName: string;
  ownerName: string;
  phone?: string;
  email?: string;
  language: "en" | "tl";
  pin: string;
};

export type Share = {
  id: string;
  token: string;
  lender: string;
  purpose: string;
  dateFrom: string;
  dateTo: string;
  sections: Section[];
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  views: { at: string; action: "opened" | "downloaded CSV" }[];
};

export type Section = "profile" | "cash_flow" | "monthly" | "receivables" | "entries";

export const CASH_IN: Kind[] = ["sale", "payment_in", "other_income"];
export const CASH_OUT: Kind[] = ["purchase", "payment_out", "expense"];

export const KIND_LABEL: Record<Kind, string> = {
  sale: "Sale",
  utang: "Utang",
  payment_in: "Payment in",
  purchase: "Purchase",
  purchase_credit: "Purchase on credit",
  payment_out: "Payment out",
  expense: "Expense",
  other_income: "Other income",
};

export const TIER_LABEL: Record<Tier, string> = {
  verified: "Verified",
  matched: "Matched",
  corroborated: "Corroborated",
  self_reported: "Self-reported",
};

export const STORE = {
  name: "Aling Nena's Store",
  legalName: "Aling Nena's Sari-sari Store",
  type: "Neighborhood retail store",
  city: "Quezon City",
  since: 2019,
};

export const CONTACTS: Contact[] = [
  { name: "Mang Ben", type: "customer", photo: "#B45309" },
  { name: "Aling Rosa", type: "customer", photo: "#7C3AED" },
  { name: "Tisoy", type: "customer", photo: "#0369A1" },
  { name: "Ate Lorna", type: "customer", photo: "#BE185D" },
  { name: "Mang Jun", type: "customer", photo: "#4D7C0F" },
  { name: "Pareng Gary", type: "supplier", photo: "#0F766E" },
  { name: "Mang Tomas Wholesale", type: "supplier", photo: "#9A3412" },
];

// ---------- dates ----------

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgo(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return iso(d);
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayDiff(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000);
}

export const today = () => iso(new Date());

// ---------- formatting ----------

export function peso(n: number, sign = false): string {
  const s = "₱" + Math.abs(Math.round(n)).toLocaleString("en-US");
  if (!sign) return n < 0 ? "-" + s : s;
  return (n < 0 ? "-" : "+") + s;
}

export function longDate(s: string): string {
  return parseDay(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function shortDate(s: string, year = false): string {
  return parseDay(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
  });
}

export function clock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ---------- Aling Nena's sample ledger ----------
// 45 days of a sari-sari store, the same every load, dated relative to today.
// She started LedgeLeaf 7 days ago: the 7 newest days were logged live, and
// the older days were copied in from her notebook on her first day (so they
// count as late entries). That's the "from notebook to loan-ready" story.

const JOINED_DAYS_AGO = 6; // today plus the 6 days before it = 7 days on time

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function sampleEntries(): Entry[] {
  const rand = rng(7);
  const now = new Date();
  const out: Entry[] = [];
  let n = 0;

  const add = (back: number, e: Omit<Entry, "id" | "saleDate" | "recordedAt" | "time"> & { time?: string }) => {
    const saleDate = daysAgo(back, now);
    const time = e.time ?? `${String(7 + Math.floor(rand() * 13)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}`;
    // Notebook days were typed in on the day she joined.
    const recDay = back > JOINED_DAYS_AGO ? daysAgo(JOINED_DAYS_AGO, now) : saleDate;
    const recordedAt = `${recDay}T${back > JOINED_DAYS_AGO ? "20:00" : time}:00`;
    out.push({ ...e, id: `s${++n}`, saleDate, time, recordedAt });
  };

  const goods = [
    "Softdrinks", "Rice 2kg", "Load", "Eggs and bread", "Canned goods", "Snacks",
    "Coffee sachets", "Cooking oil", "Noodles", "Ice and water", "Soap and shampoo",
  ];

  for (let back = 44; back >= 1; back--) {
    const count = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const r = rand();
      const tier: Tier = r < 0.6 ? "verified" : r < 0.86 ? "corroborated" : "self_reported";
      add(back, {
        kind: "sale",
        amount: tier === "corroborated" ? (20 + Math.floor(rand() * 20)) * 10 : (3 + Math.floor(rand() * 18)) * 10,
        tier,
        description: tier === "corroborated" ? "Cash, deposited" : goods[Math.floor(rand() * goods.length)],
      });
    }
    if (back % 3 === 1) {
      add(back, {
        kind: "purchase", amount: (16 + Math.floor(rand() * 8)) * 50, tier: "matched",
        contact: "Pareng Gary", description: "Weekly restock", time: "09:10",
      });
    }
    if (back % 7 === 2) {
      add(back, { kind: "expense", amount: 150, tier: "matched", description: "Electricity share", time: "17:30" });
    }
    if (back % 5 === 0) {
      add(back, { kind: "expense", amount: 60, tier: "self_reported", description: "Ice", time: "13:15" });
    }
  }

  // Utang, set so 4 customers owe ₱1,240 in total, matching the statement.
  add(36, { kind: "utang", amount: 320, tier: "self_reported", contact: "Mang Ben", description: "Bigas at sardinas" });
  add(20, { kind: "utang", amount: 140, tier: "self_reported", contact: "Mang Jun", description: "Softdrinks for a party" });
  add(15, { kind: "payment_in", amount: 140, tier: "self_reported", contact: "Mang Jun" });
  add(12, { kind: "utang", amount: 400, tier: "self_reported", contact: "Aling Rosa", description: "Groceries" });
  add(9, { kind: "utang", amount: 390, tier: "self_reported", contact: "Ate Lorna", description: "Merienda for the tricycle drivers" });
  add(5, { kind: "utang", amount: 180, tier: "self_reported", contact: "Tisoy", description: "Load and snacks" });
  add(2, { kind: "utang", amount: 150, tier: "self_reported", contact: "Tisoy", description: "Coffee and bread" });

  // Stock on credit: the store owes 2 suppliers ₱3,200.
  add(10, { kind: "purchase_credit", amount: 1200, tier: "matched", contact: "Mang Tomas Wholesale", description: "Rice, 2 sacks" });
  add(4, { kind: "purchase_credit", amount: 2000, tier: "matched", contact: "Pareng Gary", description: "Softdrinks, 4 cases" });

  // Today: ₱3,450 in, ₱2,210 out, ₱1,240 profit.
  add(0, { kind: "purchase", amount: 1850, tier: "matched", contact: "Pareng Gary", description: "Weekly restock", time: "07:40",
    items: [{ name: "Coke 1.5L, case of 12", qty: 1, price: 1200 }, { name: "Skyflakes, box of 10", qty: 2, price: 325 }] });
  add(0, { kind: "sale", amount: 1480, tier: "corroborated", description: "Cash, deposited", time: "08:30" });
  add(0, { kind: "sale", amount: 620, tier: "verified", description: "Load and snacks", time: "09:45" });
  add(0, { kind: "payment_in", amount: 200, tier: "self_reported", contact: "Aling Rosa", time: "11:02" });
  add(0, { kind: "sale", amount: 110, tier: "verified", description: "Rice 2kg", time: "12:20" });
  add(0, { kind: "expense", amount: 60, tier: "self_reported", description: "Ice", time: "13:15" });
  add(0, { kind: "expense", amount: 300, tier: "matched", description: "Delivery fee", time: "13:40" });
  add(0, { kind: "sale", amount: 120, tier: "self_reported", description: "2 Coke, 1 Skyflakes", time: "14:41",
    items: [{ name: "Coke 1.5L", qty: 2, price: 45 }, { name: "Skyflakes", qty: 1, price: 30 }],
    voided: { reason: "Entered twice", at: `${today()}T14:50:00` } });
  add(0, { kind: "sale", amount: 965, tier: "verified", description: "Softdrinks", time: "15:05" });
  add(0, { kind: "sale", amount: 75, tier: "self_reported", description: "6 eggs, 1 bread", time: "16:10" });

  return out;
}

// ---------- storage ----------

const KEY = "ledgeleaf.v1";

type Saved = {
  account?: Account;
  added: Entry[]; // entries the owner made on this phone
  voids: Record<string, { reason: string; at: string }>; // voids of sample entries
  shares: Share[];
  papers: string[];
};

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { added: [], voids: {}, shares: [], papers: [], ...JSON.parse(raw) };
  } catch {
    /* private mode or bad data: start fresh */
  }
  return { added: [], voids: {}, shares: [], papers: [] };
}

let saved = load();
let sample = sampleEntries();
const listeners = new Set<() => void>();

// Another tab (say, the lender view opened from a share link) changed the
// saved data: pick it up so view counts update live.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (ev) => {
    if (ev.key !== KEY) return;
    saved = load();
    listeners.forEach((l) => l());
  });
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
  listeners.forEach((l) => l());
}

export const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  account: () => saved.account,
  setAccount(a: Account | undefined) {
    saved = { ...saved, account: a };
    persist();
  },
  entries(): Entry[] {
    const all = [
      ...sample.map((e) => (saved.voids[e.id] ? { ...e, voided: saved.voids[e.id] } : e)),
      ...saved.added,
    ];
    return all.sort((a, b) => (b.saleDate + b.time).localeCompare(a.saleDate + a.time));
  },
  addEntry(e: Omit<Entry, "id" | "recordedAt">) {
    const entry: Entry = { ...e, id: `e${Date.now()}`, recordedAt: new Date().toISOString() };
    saved = { ...saved, added: [...saved.added, entry] };
    persist();
    return entry;
  },
  voidEntry(id: string, reason: string) {
    const v = { reason: reason || "No reason given", at: new Date().toISOString() };
    if (id.startsWith("s")) saved = { ...saved, voids: { ...saved.voids, [id]: v } };
    else saved = { ...saved, added: saved.added.map((e) => (e.id === id ? { ...e, voided: v } : e)) };
    persist();
  },
  syncPending() {
    if (!saved.added.some((e) => e.pending)) return false;
    saved = { ...saved, added: saved.added.map((e) => ({ ...e, pending: false })) };
    persist();
    return true;
  },
  shares: () => saved.shares,
  addShare(s: Share) {
    saved = { ...saved, shares: [s, ...saved.shares] };
    persist();
  },
  updateShare(id: string, f: (s: Share) => Share) {
    saved = { ...saved, shares: saved.shares.map((s) => (s.id === id ? f(s) : s)) };
    persist();
  },
  papers: () => saved.papers,
  togglePaper(p: string) {
    const has = saved.papers.includes(p);
    saved = { ...saved, papers: has ? saved.papers.filter((x) => x !== p) : [...saved.papers, p] };
    persist();
  },
  reset() {
    saved = { added: [], voids: {}, shares: [], papers: [] };
    sample = sampleEntries();
    persist();
  },
};

// ---------- numbers ----------

const live = (es: Entry[]) => es.filter((e) => !e.voided);

export function cashDelta(e: Entry): number {
  if (CASH_IN.includes(e.kind)) return e.amount;
  if (CASH_OUT.includes(e.kind)) return -e.amount;
  return 0;
}

export function dayTotals(es: Entry[], day: string) {
  let cashIn = 0;
  let cashOut = 0;
  for (const e of live(es)) {
    if (e.saleDate !== day) continue;
    const d = cashDelta(e);
    if (d > 0) cashIn += d;
    else cashOut -= d;
  }
  return { cashIn, cashOut, profit: cashIn - cashOut };
}

export function isLate(e: Entry): boolean {
  // Entries that reach the phone more than 48 hours after their day are late.
  const dayEnd = parseDay(e.saleDate).getTime() + 86400000;
  return new Date(e.recordedAt).getTime() - dayEnd > 48 * 3600000;
}

/** Who owes the store (customers) or whom the store owes (suppliers). */
export function balances(es: Entry[], type: "customer" | "supplier", asOf = today()) {
  const map = new Map<string, { amount: number; oldest: string | null }>();
  const sorted = live(es)
    .filter((e) => e.saleDate <= asOf)
    .sort((a, b) => a.saleDate.localeCompare(b.saleDate));
  for (const e of sorted) {
    if (!e.contact) continue;
    const add = type === "customer" ? e.kind === "utang" : e.kind === "purchase_credit";
    const pay = type === "customer" ? e.kind === "payment_in" : e.kind === "payment_out";
    if (!add && !pay) continue;
    const b = map.get(e.contact) ?? { amount: 0, oldest: null };
    b.amount += add ? e.amount : -e.amount;
    if (add && b.oldest === null) b.oldest = e.saleDate;
    if (b.amount <= 0) {
      b.amount = 0;
      b.oldest = null;
    }
    map.set(e.contact, b);
  }
  const rows = [...map.entries()]
    .filter(([, b]) => b.amount > 0)
    .map(([name, b]) => ({ name, amount: b.amount, days: b.oldest ? dayDiff(asOf, b.oldest) : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

/** The checks lenders look at, over the last 30 days. */
export function readiness(es: Entry[]) {
  const t = today();
  const from = daysAgo(29);
  const inRange = live(es).filter((e) => e.saleDate >= from && e.saleDate <= t);
  const onTimeDays = new Set(inRange.filter((e) => !isLate(e)).map((e) => e.saleDate));
  const receipts = inRange.filter((e) => CASH_IN.includes(e.kind));
  const totalIn = receipts.reduce((s, e) => s + e.amount, 0);
  const verifiedIn = receipts.filter((e) => e.tier === "verified").reduce((s, e) => s + e.amount, 0);
  const salesDays7 = new Set(
    live(es).filter((e) => e.kind === "sale" && e.saleDate >= daysAgo(6)).map((e) => e.saleDate),
  ).size;
  // Streak: days in a row, ending today or yesterday, logged on time.
  let streak = 0;
  const allOnTime = new Set(live(es).filter((e) => !isLate(e)).map((e) => e.saleDate));
  let back = allOnTime.has(t) ? 0 : 1;
  while (allOnTime.has(daysAgo(back))) {
    streak++;
    back++;
  }
  const daysOnTime = onTimeDays.size;
  return {
    daysOnTime,
    daysToP3: Math.max(0, 30 - daysOnTime),
    verifiedPct: totalIn ? Math.round((verifiedIn / totalIn) * 100) : 0,
    salesDays7,
    streak,
  };
}

export function tierSplit(es: Entry[]) {
  const receipts = live(es).filter((e) => CASH_IN.includes(e.kind) && e.saleDate >= daysAgo(29));
  const total = receipts.reduce((s, e) => s + e.amount, 0) || 1;
  const pct = (t: Tier) => Math.round((receipts.filter((e) => e.tier === t).reduce((s, e) => s + e.amount, 0) / total) * 100);
  return { verified: pct("verified"), matched: pct("matched"), corroborated: pct("corroborated"), self_reported: pct("self_reported") };
}

// ---------- the statement a lender sees ----------

export function statement(es: Entry[], from: string, to: string) {
  const all = live(es);
  const inRange = all.filter((e) => e.saleDate >= from && e.saleDate <= to);
  const sum = (k: Kind[], list = inRange) => list.filter((e) => k.includes(e.kind)).reduce((s, e) => s + e.amount, 0);

  const cashSales = sum(["sale", "other_income"]);
  const collections = sum(["payment_in"]);
  const receipts = cashSales + collections;
  const stock = sum(["purchase", "payment_out"]);
  const opex = sum(["expense"]);
  const gross = receipts - stock;
  const net = gross - opex;
  const days = dayDiff(to, from) + 1;

  const tiers = (["verified", "matched", "corroborated", "self_reported"] as Tier[]).map((t) => {
    const amt = inRange.filter((e) => CASH_IN.includes(e.kind) && e.tier === t).reduce((s, e) => s + e.amount, 0);
    return { tier: t, amount: amt, pct: receipts ? Math.round((amt / receipts) * 100) : 0 };
  });

  // Month-by-month totals within the range.
  const months = new Map<string, { label: string; receipts: number; expenses: number }>();
  for (const e of inRange) {
    const d = parseDay(e.saleDate);
    const key = e.saleDate.slice(0, 7);
    const m = months.get(key) ?? { label: "", receipts: 0, expenses: 0 };
    const start = key === from.slice(0, 7) ? from : `${key}-01`;
    const endOfMonth = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const end = endOfMonth < to ? endOfMonth : to;
    m.label = `${parseDay(start).toLocaleDateString("en-US", { month: "long" })} ${parseDay(start).getDate()}–${parseDay(end).getDate()}, ${d.getFullYear()}`;
    const c = cashDelta(e);
    if (c > 0) m.receipts += c;
    else m.expenses -= c;
    months.set(key, m);
  }

  const dayBefore = iso(new Date(parseDay(from).getTime() - 86400000));
  const arStart = balances(es, "customer", dayBefore).total;
  const creditSales = sum(["utang"]);
  const arEnd = balances(es, "customer", to);
  const aging = { a: 0, b: 0, c: 0, d: 0 };
  // Age each customer's balance by their oldest unpaid utang.
  for (const r of arEnd.rows) {
    if (r.days <= 30) aging.a += r.amount;
    else if (r.days <= 60) aging.b += r.amount;
    else if (r.days <= 90) aging.c += r.amount;
    else aging.d += r.amount;
  }

  const daysWithEntries = new Set(inRange.map((e) => e.saleDate)).size;
  const onTimeShare = inRange.length ? Math.round((inRange.filter((e) => !isLate(e)).length / inRange.length) * 100) : 0;
  const voided = es.filter((e) => e.voided && e.saleDate >= from && e.saleDate <= to).length;

  return {
    from, to, days, cashSales, collections, receipts, stock, gross, opex, net,
    avgDaily: Math.round(receipts / days),
    tiers,
    months: [...months.values()],
    ar: { start: arStart, creditSales, collections, end: arEnd.total, customers: arEnd.rows.length, aging },
    completeness: { daysWithEntries, onTimeShare, voided },
    entries: inRange,
  };
}

export function entriesCsv(es: Entry[], from: string, to: string): string {
  // Never includes customer names, descriptions or notes.
  const rows = live(es)
    .filter((e) => e.saleDate >= from && e.saleDate <= to)
    .sort((a, b) => (a.saleDate + a.time).localeCompare(b.saleDate + b.time));
  const lines = ["date,time,kind,amount_php,trust_tier,late_entry"];
  for (const e of rows) lines.push([e.saleDate, e.time, e.kind, e.amount, e.tier, isLate(e) ? "yes" : "no"].join(","));
  return lines.join("\n") + "\n";
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function randomToken(len = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return [...buf].map((n) => chars[n % chars.length]).join("");
}
