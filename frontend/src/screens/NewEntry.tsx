// New entry sheet: amount, kind (Sales / Purchases / Others with sub-kinds,
// including utang and stock on credit), contact, description, item breakdown.

import { useState } from "react";
import { CONTACTS, KIND_LABEL, iso, peso, store, today, type Kind, type LineItem } from "../data";
import { t } from "../i18n";
import { Icon } from "../icons";
import { Avatar, Badge, Sheet, SheetHead } from "../ui";

type Group = "sales" | "purchases" | "others";

const SUBKINDS: Record<Group, { kind: Kind; label: string }[]> = {
  sales: [
    { kind: "sale", label: "Sale" },
    { kind: "utang", label: "Utang (on credit)" },
    { kind: "payment_in", label: "Payment in" },
  ],
  purchases: [
    { kind: "purchase", label: "Purchase" },
    { kind: "purchase_credit", label: "On credit" },
    { kind: "payment_out", label: "Payment out" },
  ],
  others: [
    { kind: "expense", label: "Expense" },
    { kind: "other_income", label: "Other income" },
  ],
};

const SAVE_LABEL: Record<Kind, string> = {
  sale: "Save sale",
  utang: "Save utang",
  payment_in: "Save payment",
  purchase: "Save purchase",
  purchase_credit: "Save purchase",
  payment_out: "Save payment",
  expense: "Save expense",
  other_income: "Save income",
};

const CATALOG: Record<Group, LineItem[]> = {
  sales: [
    { name: "Coke 1.5L", qty: 1, price: 45 },
    { name: "Skyflakes", qty: 1, price: 30 },
    { name: "Egg", qty: 1, price: 9 },
    { name: "Pandesal", qty: 1, price: 5 },
    { name: "Rice, per kilo", qty: 1, price: 55 },
    { name: "Load", qty: 1, price: 50 },
  ],
  purchases: [
    { name: "Coke 1.5L, case of 12", qty: 1, price: 1200 },
    { name: "Skyflakes, box of 10", qty: 1, price: 325 },
    { name: "Rice, 25kg sack", qty: 1, price: 1150 },
  ],
  others: [],
};

export function NewEntry({ onClose, onSaved, online }: { onClose: () => void; onSaved: (msg: string) => void; online: boolean }) {
  const [group, setGroup] = useState<Group>("sales");
  const [kind, setKind] = useState<Kind>("sale");
  const [amountText, setAmountText] = useState("");
  const [contact, setContact] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(today());

  const itemsTotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const amount = items.length ? itemsTotal : Number(amountText.replace(/[^\d]/g, "")) || 0;
  const needsContact = kind === "utang" || kind === "payment_in" || kind === "purchase_credit" || kind === "payment_out";
  const contactType = group === "purchases" ? "supplier" : "customer";
  const canSave = amount > 0 && (!needsContact || contact);

  const pickGroup = (g: Group) => {
    setGroup(g);
    setKind(SUBKINDS[g][0].kind);
    setContact(null);
    setItems([]);
  };

  const setQty = (i: number, d: number) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, qty: it.qty + d } : it)).filter((it) => it.qty > 0));

  const save = () => {
    const now = new Date();
    store.addEntry({
      kind,
      amount,
      tier: "self_reported",
      saleDate: date,
      time: date === iso(now) ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "20:00",
      contact: contact ?? undefined,
      description: description.trim() || (items.length ? items.map((i) => `${i.qty} ${i.name}`).join(", ") : undefined),
      items: items.length ? items : undefined,
      pending: !online,
    });
    onSaved(online ? `${KIND_LABEL[kind]} saved` : "Saved on this phone. It will sync when you're back online.");
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <SheetHead onCancel={onClose} />
      <div className="title">{t("New entry")}</div>

      <label className="field-label" htmlFor="amount">Amount</label>
      {items.length ? (
        <div className="strip amount mono">{peso(amount)}</div>
      ) : (
        <input id="amount" className="strip amount" inputMode="numeric" placeholder="₱0" autoFocus
          value={amountText ? "₱" + Number(amountText).toLocaleString("en-US") : ""}
          onChange={(e) => setAmountText(e.target.value.replace(/[^\d]/g, "").slice(0, 7))} />
      )}

      <div className="field-label">Kind</div>
      <div className="segmented">
        {(["sales", "purchases", "others"] as Group[]).map((g) => (
          <button key={g} className={group === g ? "on" : ""} onClick={() => pickGroup(g)}>
            {g[0].toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>
      <div className="chips">
        {SUBKINDS[group].map((s) => (
          <button key={s.kind} className={`chip ${kind === s.kind ? "on" : ""}`} onClick={() => setKind(s.kind)}>{s.label}</button>
        ))}
      </div>
      {kind === "utang" && <p className="note" style={{ paddingTop: 8 }}>Utang counts in your profit once the customer pays. It shows up under "You're owed".</p>}

      <div className="field-label">Contact {needsContact ? "" : "(optional)"}</div>
      <button className="strip-row" style={{ width: "100%", border: 0, borderTop: "1px solid var(--divider)", borderBottom: "1px solid var(--divider)", textAlign: "left" }} onClick={() => setPicking(!picking)}>
        {contact ? (
          <>
            <Avatar name={contact} />
            <span>{contact}</span>
            <Badge>{contactType === "supplier" ? "Supplier" : "Customer"}</Badge>
          </>
        ) : (
          <span className="muted" style={{ color: "#a9aaa5" }}>Pick a contact</span>
        )}
        <span style={{ flex: 1 }} />
        <Icon name="chevron" size={18} className="chev" />
      </button>
      {picking && (
        <div className="rows">
          {CONTACTS.filter((c) => c.type === contactType).map((c) => (
            <button key={c.name} className="row" style={{ minHeight: 48 }} onClick={() => { setContact(c.name); setPicking(false); }}>
              <Avatar name={c.name} /> <span className="row-main">{c.name}</span>
              {contact === c.name && <Icon name="check" size={18} style={{ color: "var(--teal)" }} />}
            </button>
          ))}
        </div>
      )}

      <label className="field-label" htmlFor="desc">Description (optional)</label>
      <input id="desc" className="strip" placeholder={group === "purchases" ? "Weekly restock" : group === "others" ? "October bill" : "Merienda for the tricycle drivers"}
        value={description} onChange={(e) => setDescription(e.target.value)} />

      {CATALOG[group].length > 0 && (
        <>
          <div className="field-label">Item breakdown (optional)</div>
          <div className="rows">
            {items.map((it, i) => (
              <div className="row" key={it.name}>
                <span className="row-main">
                  <div style={{ fontSize: 15 }}>{it.name}</div>
                  <div className="row-meta mono">{peso(it.price)} each</div>
                </span>
                <span className="stepper">
                  <button aria-label="Less" onClick={() => setQty(i, -1)}><Icon name="minus" size={14} /></button>
                  <span>{it.qty}</span>
                  <button className="plus" aria-label="More" onClick={() => setQty(i, 1)}><Icon name="plus" size={14} /></button>
                </span>
                <span className="row-amount" style={{ minWidth: 64, textAlign: "right", fontSize: 14 }}>{peso(it.qty * it.price)}</span>
              </div>
            ))}
            {adding ? (
              <div className="chips">
                {CATALOG[group].filter((c) => !items.some((i) => i.name === c.name)).map((c) => (
                  <button key={c.name} className="chip" onClick={() => { setItems([...items, { ...c }]); setAdding(false); }}>
                    {c.name} · {peso(c.price)}
                  </button>
                ))}
              </div>
            ) : (
              <button className="row" style={{ minHeight: 48, color: "var(--teal)", fontWeight: 500 }} onClick={() => setAdding(true)}>
                <Icon name="plus" size={18} /> Add item
              </button>
            )}
          </div>
        </>
      )}

      <label className="field-label" htmlFor="date">Date</label>
      <input id="date" type="date" className="strip" max={today()} value={date} onChange={(e) => setDate(e.target.value || today())} />
      {date !== today() && <p className="note" style={{ paddingTop: 8 }}>Logging a past day from your notebook is fine. Entries more than 2 days late are labelled "late" for lenders.</p>}

      <button className="btn sticky" disabled={!canSave} onClick={save}>{SAVE_LABEL[kind]}</button>
    </Sheet>
  );
}
