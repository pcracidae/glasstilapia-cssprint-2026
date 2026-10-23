// Transactions tab: entries grouped by day with each day's profit, the
// offline banner, and entry details (void).

import { useState } from "react";
import { cashDelta, clock, dayTotals, longDate, peso, shortDate, store, today, daysAgo, type Entry } from "../data";
import { t } from "../i18n";
import { Icon } from "../icons";
import { EntryRow, Sheet, SheetHead, Badge, entryTitle, useLedger } from "../ui";
import type { Go } from "./Overview";

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
      </div>
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
    </>
  );
}

export function entrySummary(e: Entry) {
  return `${entryTitle(e)} ${peso(e.amount)}`;
}
