// Overview ("Today" tab): store header, a swipeable stack of three hero
// cards (today's profit, credit, loan readiness), the latest entries and
// what to do next.

import { useRef, useState } from "react";
import { balances, dayTotals, longDate, peso, readiness, store, today, type Entry } from "../data";
import { t } from "../i18n";
import { Icon } from "../icons";
import { Avatar, EntryRow, useLedger } from "../ui";

export type Go = (to: string) => void;

export function StoreHeader({ go, onProfile }: { go: Go; onProfile: () => void }) {
  const es = useLedger();
  const r = readiness(es);
  const acct = store.account();
  return (
    <div className="topbar">
      <div className="store-title">
        <h1>{acct?.storeName}</h1>
        <div className="date">{longDate(today())}</div>
      </div>
      <button className="icon-btn" aria-label="Share my records" onClick={() => go("share")}>
        <Icon name="share" />
      </button>
      <span className="streak" title={`${r.streak}-day streak`}><Icon name="flame" size={16} /> {r.streak}</span>
      <button className="avatar" onClick={onProfile} aria-label="Profile">{acct?.ownerName[0] ?? "N"}</button>
    </div>
  );
}

function Dots({ on }: { on: number }) {
  return <span className="dots">{[0, 1, 2].map((i) => <i key={i} className={i === on ? "on" : ""} />)}</span>;
}

export function Overview({ go, openEntry, onProfile }: { go: Go; openEntry: (e: Entry) => void; onProfile: () => void }) {
  const es = useLedger();
  const [card, setCard] = useState(0);
  const startX = useRef<number | null>(null);
  const day = dayTotals(es, today());
  const owed = balances(es, "customer");
  const owe = balances(es, "supplier");
  const r = readiness(es);
  const latest = es.filter((e) => e.saleDate === today()).slice(0, 3);
  const loggedToday = es.some((e) => e.saleDate === today() && e.kind === "sale" && !e.voided && !e.id.startsWith("s"));
  const overdue = owed.rows.find((x) => x.days > 30);

  const swipe = {
    onPointerDown: (ev: React.PointerEvent) => { startX.current = ev.clientX; },
    onPointerUp: (ev: React.PointerEvent) => {
      if (startX.current === null) return;
      const dx = ev.clientX - startX.current;
      startX.current = null;
      if (dx < -40) setCard((c) => Math.min(2, c + 1));
      else if (dx > 40) setCard((c) => Math.max(0, c - 1));
    },
  };

  return (
    <>
      <StoreHeader go={go} onProfile={onProfile} />
      <div className="hero-wrap">
        <div className="hero-stack">
          {card === 0 && (
            <div className="hero teal" {...swipe}>
              <Dots on={0} />
              <Icon name="leaf" size={150} className="watermark" />
              <div className="label">{t("Today's profit")}</div>
              <div className="big">{peso(day.profit)}</div>
              <div className="caption mono">
                <span><Icon name="arrowUp" size={14} /> {peso(day.cashIn)} <span style={{ fontFamily: "Inter" }}>in</span></span>
                <span><Icon name="arrowDown" size={14} /> {peso(day.cashOut)} <span style={{ fontFamily: "Inter" }}>out</span></span>
              </div>
              <button className="foot" onClick={() => go("transactions")}>
                {t("Go to Transactions")} <Icon name="chevron" size={18} />
              </button>
            </div>
          )}
          {card === 1 && (
            <div className="hero blue" {...swipe}>
              <Dots on={1} />
              <div className="split">
                <button onClick={() => go("contacts:customer")}>
                  <div className="label">{t("You're owed")}</div>
                  <div className="big">{peso(owed.total)}</div>
                  <div className="small" style={{ opacity: 0.85 }}>{owed.rows.length} customers</div>
                  <div className="faces">{owed.rows.slice(0, 3).map((x) => <Avatar key={x.name} name={x.name} />)}<Icon name="chevron" size={18} style={{ marginLeft: 12 }} /></div>
                </button>
                <button onClick={() => go("contacts:supplier")}>
                  <div className="label">{t("You owe")}</div>
                  <div className="big">{peso(owe.total)}</div>
                  <div className="small" style={{ opacity: 0.85 }}>{owe.rows.length} suppliers</div>
                  <div className="faces">{owe.rows.slice(0, 3).map((x) => <Avatar key={x.name} name={x.name} />)}<Icon name="chevron" size={18} style={{ marginLeft: 12 }} /></div>
                </button>
              </div>
            </div>
          )}
          {card === 2 && (
            <div className="hero yellow" {...swipe}>
              <Dots on={2} />
              <div className="label">{t("Loan readiness")}</div>
              <div className="headline">{r.daysToP3 > 0 ? `${r.daysToP3} days to P3-ready` : "P3-ready"}</div>
              <div className="small">{r.daysOnTime} of 30 days logged · up to <span className="mono">₱50,000</span></div>
              <div className="progress"><i style={{ width: `${(r.daysOnTime / 30) * 100}%` }} /></div>
              <button className="foot" onClick={() => go("loan")}>
                {t("Go to Loan")} <Icon name="chevron" size={18} />
              </button>
            </div>
          )}
        </div>
        <div className="center" style={{ marginTop: 4 }}>
          {[0, 1, 2].map((i) => (
            <button key={i} aria-label={`Card ${i + 1}`} onClick={() => setCard(i)}
              style={{ width: i === card ? 18 : 7, height: 7, borderRadius: 4, border: 0, margin: "0 3px", background: i === card ? "var(--teal)" : "var(--divider)", padding: 0 }} />
          ))}
        </div>
      </div>

      <div className="group home">
        <span>{t("Latest")}</span>
        <button className="action" onClick={() => go("transactions")}>{t("See all")}</button>
      </div>
      <div className="rows">
        {latest.map((e) => <EntryRow key={e.id} e={e} onClick={() => openEntry(e)} />)}
        {latest.length === 0 && <div className="row muted">Nothing logged today yet.</div>}
      </div>

      <div className="group home"><span>{t("What's next")}</span></div>
      <div className="rows">
        <button className={`task ${loggedToday ? "done" : "hl"}`} onClick={() => go("new")}>
          <span className="box">{loggedToday && <Icon name="check" size={12} />}</span>
          <span className="row-main">
            <div>{t("Log today's sales")}</div>
            <div className="row-meta">Keeps your {r.streak}-day streak going</div>
          </span>
          <Icon name="pencil" size={20} />
        </button>
        <button className="task" onClick={() => go("loan")}>
          <span className="box" />
          <span className="row-main">
            <div>Take QR Ph payments</div>
            <div className="row-meta">Raises verified income from {r.verifiedPct}% to 80%</div>
          </span>
          <Icon name="qr" size={20} />
        </button>
        {overdue && (
          <button className="task" onClick={() => go("contacts:customer")}>
            <span className="box" />
            <span className="row-main">
              <div>Remind {overdue.name}</div>
              <div className="row-meta">{peso(overdue.amount)} unpaid for {overdue.days} days</div>
            </span>
            <Icon name="bell" size={20} />
          </button>
        )}
        <div className="task done">
          <span className="box"><Icon name="check" size={12} /></span>
          <span className="row-main"><div>Set up your PIN</div></span>
          <Icon name="lock" size={20} />
        </div>
      </div>
    </>
  );
}

export function ProfilePanel({ go, onClose, onLock }: { go: Go; onClose: () => void; onLock: () => void }) {
  const acct = store.account();
  const active = store.shares().filter((s) => !s.revokedAt && new Date(s.expiresAt) > new Date()).length;
  const contact = acct?.phone ? acct.phone.replace(/(\+63 \d{3}) \d{3}/, "$1 •••") : acct?.email;
  const item = (icon: string, label: string, onClick: () => void, extra?: React.ReactNode) => (
    <button className="row" style={{ minHeight: 52 }} onClick={() => { onClose(); onClick(); }}>
      <Icon name={icon} size={20} />
      <span className="row-main" style={{ fontWeight: 500 }}>{label}</span>
      {extra}
      <Icon name="chevron" size={18} className="chev" />
    </button>
  );
  return (
    <div className="overlay" style={{ alignItems: "stretch", justifyContent: "flex-end" }} onClick={onClose}>
      <div className="side-panel" style={{ right: "max(0px, calc(50% - 215px))" }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head" />
        <div style={{ padding: "0 20px 16px", marginTop: -28 }}>
          <span className="avatar lg" style={{ border: "3px solid #fff" }}>{acct?.ownerName[0]}</span>
          <div style={{ fontWeight: 600, fontSize: 17, marginTop: 8 }}>{acct?.storeName}</div>
          <div className="small muted">{contact}</div>
          <button className="link" style={{ fontSize: 14, marginTop: 4 }} onClick={() => { onClose(); go("store-profile"); }}>View profile</button>
        </div>
        <div className="rows">
          {item("link", "Sharing", () => go("sharing"), active ? <span className="badge b-verified">{active}</span> : null)}
          {item("shield", "Privacy", () => go("privacy"))}
          {item("sync", "Sync", () => go("sync"), <span style={{ width: 8, height: 8, borderRadius: 4, background: navigator.onLine ? "var(--green)" : "var(--amber)" }} />)}
          {item("download", "Export", () => go("export"))}
          {item("lock", "Lock app", onLock)}
          {item("settings", "Reset demo data", () => go("reset"))}
        </div>
      </div>
    </div>
  );
}
