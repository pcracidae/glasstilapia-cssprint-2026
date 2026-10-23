// Contacts tab: customers who owe the store and suppliers the store owes,
// with a polite reminder the owner sends themselves (never public).

import { useState } from "react";
import { CONTACTS, balances, peso, store } from "../data";
import { t } from "../i18n";
import { Icon } from "../icons";
import { Avatar, BackLink, EntryRow, useLedger } from "../ui";

export function Contacts({ initial, toast }: { initial: "customer" | "supplier"; toast: (m: string) => void }) {
  const es = useLedger();
  const [type, setType] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const bal = balances(es, type);

  if (open) {
    const b = bal.rows.find((r) => r.name === open);
    const mine = es.filter((e) => e.contact === open);
    const reminder = `Hi ${open}! Paalala lang po sa utang na ${peso(b?.amount ?? 0)} sa ${store.account()?.storeName}. Salamat po!`;
    return (
      <>
        <BackLink label={t("Contacts")} onClick={() => setOpen(null)} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
          <Avatar name={open} size="lg" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{open}</div>
            <div className="muted small">{type === "customer" ? "Customer" : "Supplier"}</div>
          </div>
        </div>
        <div className="kv">
          <span>{type === "customer" ? "Owes you" : "You owe"}</span>
          <b className={`mono ${type === "customer" ? "out" : "credit"}`}>{peso(b?.amount ?? 0)}</b>
        </div>
        {b && b.amount > 0 && <div className="kv"><span className="muted">Oldest unpaid</span><b>{b.days} days</b></div>}
        {type === "customer" && b && b.amount > 0 && (
          <>
            <div className="group">Reminder you can send</div>
            <div className="strip" style={{ fontSize: 15 }}>{reminder}</div>
            <button className="btn" onClick={() => {
              navigator.clipboard?.writeText(reminder).catch(() => {});
              toast("Reminder copied. Paste it in SMS or Messenger.");
            }}><Icon name="copy" size={18} /> Copy reminder</button>
            <p className="note">You send it yourself. LedgeLeaf never contacts your customers.</p>
          </>
        )}
        <div className="group">History</div>
        <div className="rows">{mine.map((e) => <EntryRow key={e.id} e={e} />)}</div>
      </>
    );
  }

  const others = CONTACTS.filter((c) => c.type === type && !bal.rows.some((r) => r.name === c.name));
  return (
    <>
      <div className="topbar"><h1>{t("Contacts")}</h1></div>
      <div className="segmented" style={{ margin: "0 20px", borderRadius: 10 }}>
        <button className={type === "customer" ? "on" : ""} onClick={() => setType("customer")}>{t("Customers")}</button>
        <button className={type === "supplier" ? "on" : ""} onClick={() => setType("supplier")}>{t("Suppliers")}</button>
      </div>
      <div className="group">
        <span>{type === "customer" ? "Owe you" : "You owe"}</span>
        <span className={`mono ${type === "customer" ? "out" : "credit"}`} style={{ textTransform: "none" }}>{peso(bal.total)}</span>
      </div>
      <div className="rows">
        {bal.rows.map((r) => (
          <button key={r.name} className="row" onClick={() => setOpen(r.name)}>
            <Avatar name={r.name} size="md" />
            <span className="row-main">
              <div className="row-title">{r.name}</div>
              <div className="row-meta">
                {r.days > 30 ? <span className="badge b-red">Overdue · {r.days} days</span> : `Oldest unpaid ${r.days} days ago`}
              </div>
            </span>
            <span className={`row-amount ${type === "customer" ? "out" : "credit"}`}>{peso(r.amount)}</span>
            <Icon name="chevron" size={18} className="chev" />
          </button>
        ))}
      </div>
      {others.length > 0 && (
        <>
          <div className="group">All settled</div>
          <div className="rows">
            {others.map((c) => (
              <button key={c.name} className="row" onClick={() => setOpen(c.name)}>
                <Avatar name={c.name} size="md" />
                <span className="row-main"><div className="row-title">{c.name}</div></span>
                <span className="row-amount" style={{ color: "var(--grey)" }}>₱0</span>
                <Icon name="chevron" size={18} className="chev" />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
