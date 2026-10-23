// Consent-based sharing: set up (lender, purpose, range, expiry), check what
// they'll see, link ready, and the Sharing list with view counts and Stop.
// Mirrors the sharing backend in PR #5 (sections, expiry, revoke, view log),
// but runs on the phone so the demo works offline. Links open the lender
// statement at #/s/<token> in this browser.

import { useState } from "react";
import {
  STORE, balances, daysAgo, downloadCsv, entriesCsv, peso, randomToken, shortDate, statement, store, today,
  type Section, type Share,
} from "../data";
import { Icon } from "../icons";
import { BackLink, Sheet, useLedger } from "../ui";

export type ShareDraft = {
  lender: string;
  purpose: string;
  range: 30 | 90;
  expires: 7 | 14 | 30;
};

const LENDERS = ["Bayanihan Microfinance", "San Isidro Cooperative", "Small Business Corporation", "Mang Tomas Wholesale"];

export function shareLink(token: string) {
  return `${location.origin}${location.pathname}#/s/${token}`;
}

export function ShareSetup({ draft, onClose, onNext }: { draft: ShareDraft; onClose: () => void; onNext: (d: ShareDraft) => void }) {
  const [d, setD] = useState(draft);
  const es = useLedger();
  const from = daysAgo(d.range - 1);
  const logged = new Set(es.filter((e) => e.saleDate >= from).map((e) => e.saleDate)).size;
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head"><span className="grabber" /></div>
      <div className="title" style={{ fontSize: 20 }}>Share my records</div>
      <label className="field-label" htmlFor="lender">Lender</label>
      <input id="lender" className="strip" list="lenders" value={d.lender} onChange={(e) => setD({ ...d, lender: e.target.value })} />
      <datalist id="lenders">{LENDERS.map((l) => <option key={l} value={l} />)}</datalist>
      <div className="field-label">Purpose</div>
      <div className="chips">
        {["Loan application", "Supplier credit", "Other"].map((p) => (
          <button key={p} className={`chip ${d.purpose === p ? "on" : ""}`} onClick={() => setD({ ...d, purpose: p })}>{p}</button>
        ))}
      </div>
      <div className="field-label">Records from</div>
      <div className="chips">
        {([30, 90] as const).map((n) => (
          <button key={n} className={`chip ${d.range === n ? "on" : ""}`} onClick={() => setD({ ...d, range: n })}>Last {n} days</button>
        ))}
      </div>
      <p className="note" style={{ paddingTop: 6 }}>{shortDate(from)} – {shortDate(today(), true)} · {logged} days logged</p>
      <div className="field-label">Link works for</div>
      <div className="chips">
        {([7, 14, 30] as const).map((n) => (
          <button key={n} className={`chip ${d.expires === n ? "on" : ""}`} onClick={() => setD({ ...d, expires: n })}>{n} days</button>
        ))}
      </div>
      <button className="btn" disabled={!d.lender.trim()} onClick={() => onNext(d)}>Preview what they'll see</button>
      <button className="text-btn" onClick={() => {
        downloadCsv(`ledgeleaf-entries-${from}-to-${today()}.csv`, entriesCsv(es, from, today()));
        onClose();
      }}>Download a CSV file instead</button>
    </Sheet>
  );
}

export function ShareCheck({ draft, back, onShared }: { draft: ShareDraft; back: () => void; onShared: (s: Share) => void }) {
  const es = useLedger();
  const from = daysAgo(draft.range - 1);
  const to = today();
  const st = statement(es, from, to);
  const owed = balances(es, "customer");
  const [sections, setSections] = useState<Section[]>(["profile", "cash_flow"]);
  const expires = new Date();
  expires.setDate(expires.getDate() + draft.expires);
  const toggle = (s: Section) => setSections((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));
  const opt = (s: Section, title: string, meta: string) => (
    <label className="check-row" key={s}>
      <input type="checkbox" checked={sections.includes(s)} onChange={() => toggle(s)} />
      <span><div>{title}</div><div className="row-meta">{meta}</div></span>
    </label>
  );
  return (
    <>
      <BackLink label="Edit" onClick={back} />
      <div className="title">Check before you share</div>
      <div className="subtitle">For {draft.lender} · {shortDate(from)} – {shortDate(to, true)}</div>
      <div className="group">What to include</div>
      <div className="rows">
        {opt("profile", "Store profile", `Sari-sari store in ${STORE.city} since ${STORE.since}`)}
        {opt("cash_flow", "Cash flow", `Income ${peso(st.receipts)} · expenses ${peso(st.stock + st.opex)} · profit ${peso(st.net)}`)}
        {opt("monthly", "Month-by-month totals", "Income, expenses and profit for each month")}
        {opt("receivables", "Money owed to you", `${peso(owed.total)} in total, by age. Never who owes it`)}
        {opt("entries", "Each entry, as a CSV file", "Date, kind and amount of every entry")}
      </div>
      <div className="group">They won't see</div>
      <div className="rows">
        <div className="check-row">
          <Icon name="shield" size={18} />
          <span><div>Customer names, notes and photos</div><div className="row-meta">Or anything before {shortDate(from)} or after {shortDate(to)}</div></span>
        </div>
      </div>
      <p className="note">This link expires on {expires.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. You can stop it any time and see every time it's opened.</p>
      <button className="btn" disabled={sections.length === 0} onClick={() => {
        const share: Share = {
          id: randomToken(6),
          token: randomToken(10),
          lender: draft.lender.trim(),
          purpose: draft.purpose,
          dateFrom: from,
          dateTo: to,
          sections,
          createdAt: new Date().toISOString(),
          expiresAt: expires.toISOString(),
          views: [],
        };
        store.addShare(share);
        onShared(share);
      }}>Share with {draft.lender}</button>
    </>
  );
}

export function ShareReady({ share, done, toast }: { share: Share; done: () => void; toast: (m: string) => void }) {
  const s = store.shares().find((x) => x.id === share.id) ?? share;
  const link = shareLink(s.token);
  const labels: Record<Section, string> = { profile: "Profile", cash_flow: "cash flow", monthly: "monthly", receivables: "money owed", entries: "CSV" };
  return (
    <>
      <div className="topbar">
        <h1>Your link is ready</h1>
        <button className="icon-btn" aria-label="Copy link" onClick={() => { navigator.clipboard?.writeText(link).catch(() => {}); toast("Link copied"); }}>
          <Icon name="copy" />
        </button>
      </div>
      <a className="pad small mono" style={{ color: "var(--teal)", wordBreak: "break-all", display: "block" }} href={link} target="_blank" rel="noreferrer">…/s/{s.token}</a>
      <div className="group">This link</div>
      <div className="kv"><span>Shared with</span><b>{s.lender}</b></div>
      <div className="kv"><span>Includes</span><b>{s.sections.map((x) => labels[x]).join(", ")}</b></div>
      <div className="kv"><span>Records from</span><b>{shortDate(s.dateFrom)} – {shortDate(s.dateTo, true)}</b></div>
      <div className="kv"><span>Works until</span><b>{new Date(s.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</b></div>
      <div className="kv"><span>Opened</span><b>{s.views.length ? `${s.views.length} time${s.views.length > 1 ? "s" : ""}` : "Not yet"}</b></div>
      <button className="btn" onClick={done}>Done</button>
      <a className="text-btn center" style={{ display: "block", textDecoration: "none" }} href={link} target="_blank" rel="noreferrer">Open the lender's view</a>
      {!s.revokedAt && (
        <button className="text-btn red" onClick={() => { store.updateShare(s.id, (x) => ({ ...x, revokedAt: new Date().toISOString() })); toast("Link stopped"); done(); }}>
          Stop sharing this link
        </button>
      )}
    </>
  );
}

export function shareStatus(s: Share) {
  if (s.revokedAt) return "stopped";
  if (new Date(s.expiresAt) < new Date()) return "expired";
  return "active";
}

export function Sharing({ back, newShare, openShare }: { back: () => void; newShare: () => void; openShare: (s: Share) => void }) {
  useLedger();
  const es = store.entries();
  const all = store.shares();
  const active = all.filter((s) => shareStatus(s) === "active");
  const old = all.filter((s) => shareStatus(s) !== "active");
  const row = (s: Share) => {
    const st = shareStatus(s);
    const csv = s.views.filter((v) => v.action === "downloaded CSV").length;
    return (
      <div className="row" key={s.id} style={st !== "active" ? { color: "var(--grey)" } : undefined}>
        <button className="row-main" style={{ background: "none", border: 0, textAlign: "left", padding: 0 }} onClick={() => openShare(s)}>
          <div className="row-title" style={{ fontSize: 15 }}>{s.lender}</div>
          <div className="row-meta">
            {s.sections.length >= 4 ? "All records" : s.sections.join(", ").replace("cash_flow", "cash flow")} ·{" "}
            {st === "active" ? `until ${shortDate(s.expiresAt.slice(0, 10))}` : st === "stopped" ? `stopped ${shortDate(s.revokedAt!.slice(0, 10))}` : "expired"}
            {csv > 0 && ` · CSV downloaded ${csv === 1 ? "once" : `${csv} times`}`}
          </div>
        </button>
        <span className="small" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="eye" size={14} /> {s.views.length}</span>
        {st === "active" && (
          <button className="link" style={{ color: "var(--red)", fontWeight: 600, fontSize: 14 }}
            onClick={() => store.updateShare(s.id, (x) => ({ ...x, revokedAt: new Date().toISOString() }))}>Stop</button>
        )}
      </div>
    );
  };
  return (
    <>
      <BackLink label="Back" onClick={back} />
      <div className="title">Sharing</div>
      <div className="subtitle">Who can see your records. Nothing leaves this phone unless you share it.</div>
      <div className="group">Active</div>
      <div className="rows">{active.length ? active.map(row) : <div className="row muted">No active links.</div>}</div>
      {old.length > 0 && (<><div className="group">Stopped or expired</div><div className="rows">{old.map(row)}</div></>)}
      <button className="btn ghost" onClick={newShare}>Share my records</button>
      <button className="text-btn" onClick={() => downloadCsv(`ledgeleaf-entries-${daysAgo(29)}-to-${today()}.csv`, entriesCsv(es, daysAgo(29), today()))}>
        Download a CSV file
      </button>
    </>
  );
}
