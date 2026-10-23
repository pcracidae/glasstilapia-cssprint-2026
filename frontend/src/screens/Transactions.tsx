// Transactions tab: the trust split bar, entries grouped by day with each
// day's profit, the offline banner, entry details (void) and the tiers sheet.

import { useState } from "react";
import { cashDelta, clock, dayTotals, longDate, peso, shortDate, store, tierSplit, today, daysAgo, type Entry } from "../data";
import { t } from "../i18n";
import { Icon } from "../icons";
import { EntryRow, Sheet, SheetHead, TierBadge, Badge, entryTitle, useLedger } from "../ui";
import type { Go } from "./Overview";

export function TierBar({ onClick }: { onClick: () => void }) {
  const es = useLedger();
  const s = tierSplit(es);
  const parts = [
    { pct: s.verified, bg: "var(--green)", icon: "check" },
    { pct: s.matched, bg: "var(--blue)", icon: "lines" },
    { pct: s.corroborated, bg: "var(--amber)", icon: "book" },
    { pct: s.self_reported, bg: "#5f6368", icon: "circle" },
  ].filter((p) => p.pct > 0);
  return (
    <button className="tierbar" onClick={onClick} aria-label="How sure is each entry?">
      {parts.map((p, i) => (
        <span key={i} style={{ width: `${p.pct}%`, background: p.bg }}>
          <Icon name={p.icon} size={11} /> {p.pct}%{i === 0 ? " verified" : ""}
        </span>
      ))}
    </button>
  );
}

export function TiersSheet({ onClose }: { onClose: () => void }) {
  const rows: [React.ReactNode, string][] = [
    [<TierBadge tier="verified" />, "Paid by QR Ph to your own store account. The payment system confirms it."],
    [<TierBadge tier="matched" />, "Matches the e-wallet history or supplier receipt you imported."],
    [<TierBadge tier="corroborated" />, "Cash that adds up with your bank or e-wallet deposits, or your wholesaler receipts."],
    [<TierBadge tier="self_reported" />, "Your word only. It still counts in your own profit."],
  ];
  return (
    <Sheet onClose={onClose}>
      <div style={{ padding: "20px 20px 0" }}>
        <h2 style={{ margin: "8px 0 4px", fontSize: 20 }}>How sure is each entry?</h2>
        <div className="small muted">Every entry gets a label for how well it is backed up. Lenders trust the top ones most.</div>
        {rows.map(([b, text], i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, marginTop: 18, fontSize: 15 }}>
            <div>{b}</div>
            <div>{text}</div>
          </div>
        ))}
      </div>
      <button className="btn" onClick={onClose}>Got it</button>
    </Sheet>
  );
}

export function EntryDetails({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const delta = cashDelta(entry);
  return (
    <Sheet onClose={onClose}>
      <SheetHead onCancel={onClose} label={entry.voided ? "Close" : "Cancel"} />
      <div className="title">Entry details</div>
      <div className="group">This entry</div>
      <div className="rows">
        <EntryRow e={entry} />
      </div>
      <div className="kv"><span className="muted">Date</span><b>{shortDate(entry.saleDate, true)}, {clock(entry.time)}</b></div>
      <div className="kv"><span className="muted">Recorded</span><b>{new Date(entry.recordedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b></div>
      {entry.contact && <div className="kv"><span className="muted">Contact</span><b>{entry.contact}</b></div>}
      {entry.items?.map((it) => (
        <div className="kv" key={it.name}><span>{it.qty} × {it.name}</span><b className="mono">{peso(it.qty * it.price)}</b></div>
      ))}
      <div className="kv"><span className="muted">Counts in profit</span><b>{entry.voided ? "No (voided)" : delta === 0 ? "Not until paid" : "Yes"}</b></div>
      {entry.voided ? (
        <p className="note">Voided: {entry.voided.reason}. Voided entries stay in the log so lenders can see corrections, but they're left out of your totals.</p>
      ) : (
        <>
          <label className="field-label" htmlFor="reason">Reason (optional)</label>
          <input id="reason" className="strip" placeholder="Entered twice" value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="note">This entry will be marked Voided and left out of your totals.</p>
          <button className="btn red" onClick={() => { store.voidEntry(entry.id, reason); onClose(); }}>Void this entry</button>
        </>
      )}
    </Sheet>
  );
}

export function Transactions({ go, openEntry, online, justSynced }: {
  go: Go; openEntry: (e: Entry) => void; online: boolean; justSynced: boolean;
}) {
  const es = useLedger();
  const [tiers, setTiers] = useState(false);
  const [days, setDays] = useState(7);
  const from = daysAgo(days - 1);
  const shown = es.filter((e) => e.saleDate >= from);
  const groups: { day: string; entries: Entry[] }[] = [];
  for (const e of shown) {
    const g = groups[groups.length - 1];
    if (g && g.day === e.saleDate) g.entries.push(e);
    else groups.push({ day: e.saleDate, entries: [e] });
  }
  const label = (d: string) => (d === today() ? "Today · " : d === daysAgo(1) ? "Yesterday · " : "") + shortDate(d);

  return (
    <>
      {!online && <div className="banner offline"><Icon name="wifiOff" size={16} /> No signal. Entries are saved on this phone.</div>}
      {online && justSynced && <div className="banner online"><Icon name="okCircle" size={16} /> Back online. All entries synced.</div>}
      <div className="topbar">
        <h1>{t("Transactions")}</h1>
        <button className="icon-btn" aria-label="Share my records" onClick={() => go("share")}><Icon name="share" /></button>
        <button className="icon-btn" aria-label="How sure is each entry?" onClick={() => setTiers(true)}><Icon name="help" /></button>
      </div>
      <TierBar onClick={() => setTiers(true)} />
      {groups.map((g) => {
        const p = dayTotals(es, g.day).profit;
        return (
          <div key={g.day}>
            <div className="group">
              <span title={longDate(g.day)}>{label(g.day)}</span>
              <span className={`mono ${p >= 0 ? "in" : "out"}`} style={{ textTransform: "none", fontSize: 13 }}>Profit {peso(p, true)}</span>
            </div>
            <div className="rows">
              {g.entries.map((e) => <EntryRow key={e.id} e={e} onClick={() => openEntry(e)} />)}
            </div>
          </div>
        );
      })}
      <button className="text-btn" onClick={() => setDays((d) => d + 14)}>Show older entries</button>
      <p className="note center">
        <Badge kind="neutral">{es.filter((e) => e.pending).length} waiting to sync</Badge>
      </p>
      {tiers && <TiersSheet onClose={() => setTiers(false)} />}
    </>
  );
}

export function entrySummary(e: Entry) {
  return `${entryTitle(e)} ${peso(e.amount)}`;
}
