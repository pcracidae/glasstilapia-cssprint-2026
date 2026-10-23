// Small pieces shared by the screens.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { CONTACTS, KIND_LABEL, cashDelta, clock, peso, store, type Entry } from "./data";
import { Icon } from "./icons";

let version = 0;
store.subscribe(() => version++);

/** Re-render whenever the ledger, shares or account change. */
export function useStoreVersion() {
  return useSyncExternalStore(store.subscribe, () => version);
}

export function useLedger() {
  useStoreVersion();
  return store.entries();
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function Badge({ kind = "neutral", children }: { kind?: string; children: ReactNode }) {
  return <span className={`badge b-${kind}`}>{children}</span>;
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" | "md" }) {
  const c = CONTACTS.find((x) => x.name === name);
  const initials = name.split(" ").filter((w) => !/^(mang|aling|ate|pareng)$/i.test(w)).map((w) => w[0]).join("").slice(0, 2) || name[0];
  return (
    <span className={`avatar ${size === "md" ? "" : size}`} style={{ background: c?.photo ?? "var(--teal)" }}>
      {initials.toUpperCase()}
    </span>
  );
}

export function entryTitle(e: Entry): string {
  const what = e.kind === "payment_in" || e.kind === "payment_out" || e.kind === "utang" || e.kind.startsWith("purchase")
    ? e.contact ?? e.description
    : e.description;
  return what ? `${KIND_LABEL[e.kind]} · ${what}` : KIND_LABEL[e.kind];
}

export function EntryRow({ e, onClick }: { e: Entry; onClick?: () => void }) {
  const delta = cashDelta(e);
  const cls = e.voided ? "void" : delta > 0 ? "in" : delta < 0 ? "out" : "credit";
  const amount = delta !== 0 ? peso(delta, true) : peso(e.amount);
  const glyphBg = e.voided ? "#e8e8e4" : "#f1f1ee";
  const glyphColor = e.voided ? "#3c4043" : "var(--muted)";
  return (
    <button className={`row ${e.voided ? "voided" : ""}`} onClick={onClick}>
      <span className="glyph" style={{ background: glyphBg, color: glyphColor }}>
        <Icon name={e.voided ? "voided" : "circle"} size={18} />
      </span>
      <span className="row-main">
        <div className="row-title">{entryTitle(e)}</div>
        <div className="row-meta">
          {clock(e.time)}
          {e.voided ? (
            <Badge kind="voided"><Icon name="voided" size={11} /> Voided</Badge>
          ) : e.pending ? (
            <Badge kind="pending"><Icon name="clock" size={11} /> Saved</Badge>
          ) : null}
          {e.kind === "utang" && !e.voided && <Badge kind="red">Utang</Badge>}
          {e.kind === "purchase_credit" && !e.voided && <Badge kind="matched">On credit</Badge>}
        </div>
      </span>
      <span className={`row-amount ${cls}`}>{amount}</span>
    </button>
  );
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(ev) => ev.stopPropagation()} role="dialog">
        {children}
      </div>
    </div>
  );
}

export function SheetHead({ onCancel, label = "Cancel" }: { onCancel: () => void; label?: string }) {
  return (
    <div className="sheet-head">
      <span className="grabber" />
      <button className="link" onClick={onCancel}>{label}</button>
    </div>
  );
}

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="link back" onClick={onClick}>
      <Icon name="back" size={18} /> {label}
    </button>
  );
}

let toastTimer: number | undefined;
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => {
    setMsg(m);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setMsg(null), 2600);
  };
  const node = msg ? <div className="toast">{msg}</div> : null;
  return [node, show] as const;
}
