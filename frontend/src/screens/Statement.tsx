// The lender's view of a share link: a Statement of Business Records built
// from the owner's ledger, limited to the sections the owner chose. It never
// shows customer names, descriptions or notes.

import { useEffect, useRef } from "react";
import { STORE, downloadCsv, entriesCsv, shortDate, statement, store, type Share } from "../data";
import { shareStatus } from "./Share";

const n = (v: number) => v.toLocaleString("en-US");
const neg = (v: number) => (v ? `(${n(v)})` : "0");

export function refNo(s: Share) {
  return `SR-${s.createdAt.slice(0, 4)}-${s.createdAt.slice(5, 7)}${s.createdAt.slice(8, 10)}-${s.token.slice(0, 4).toUpperCase()}`;
}

export function Statement({ token }: { token: string }) {
  const share = store.shares().find((s) => s.token === token);
  const logged = useRef(false);
  const status = share ? shareStatus(share) : "missing";

  useEffect(() => {
    if (!share || status !== "active" || logged.current) return;
    logged.current = true;
    store.updateShare(share.id, (s) => ({ ...s, views: [...s.views, { at: new Date().toISOString(), action: "opened" }] }));
  }, [share, status]);

  if (!share || status !== "active") {
    return (
      <div className="statement">
        <h1>Statement of Business Records</h1>
        <div className="gone">
          {status === "missing" ? "This link isn't valid. Ask the business owner for a new one." : `This link was ${status === "stopped" ? "stopped by the owner" : "only valid until " + shortDate(share!.expiresAt.slice(0, 10), true)}.`}
        </div>
      </div>
    );
  }

  const es = store.entries();
  const st = statement(es, share.dateFrom, share.dateTo);
  const has = (s: string) => share.sections.includes(s as never);
  const issued = new Date(share.createdAt);
  const issuedText = issued.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const expires = new Date(share.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="statement">
      <h1>Statement of Business Records</h1>
      <div className="sub">Prepared on a cash basis from the owner's own records. Unaudited.</div>
      <div className="ref">Ref. {refNo(share)} · Issued {issuedText}</div>
      <div className="rule" />
      <dl className="meta">
        {has("profile") && (<><dt>Business</dt><dd>{STORE.legalName}, {STORE.type.toLowerCase()}, {STORE.city} (since {STORE.since})</dd></>)}
        <dt>Prepared for</dt><dd>{share.lender} · {share.purpose}</dd>
        <dt>Period</dt><dd>{shortDate(share.dateFrom)} – {shortDate(share.dateTo, true)} ({st.days} days)</dd>
        <dt>Access</dt><dd>Valid until {expires}</dd>
      </dl>

      {has("cash_flow") && (
        <>
          <div className="kpis">
            <div><small>Total cash receipts (PHP)</small><b>{n(st.receipts)}</b></div>
            <div><small>Net income (PHP)</small><b>{n(st.net)}</b></div>
            <div><small>Average daily receipts (PHP)</small><b>{n(st.avgDaily)}</b></div>
            <div><small>Accounts receivable (PHP)</small><b>{has("receivables") ? n(st.ar.end) : "—"}</b></div>
          </div>

          <h2>1. Statement of income (cash basis)</h2>
          <table>
            <thead><tr><th></th><th>Amount (PHP)</th></tr></thead>
            <tbody>
              <tr><td>Cash sales</td><td className="n">{n(st.cashSales)}</td></tr>
              <tr><td>Collections on credit sales<small>Payments received during the period for earlier credit sales</small></td><td className="n">{n(st.collections)}</td></tr>
              <tr className="total"><td>Total cash receipts</td><td className="n">{n(st.receipts)}</td></tr>
              <tr><td>Less: Stock purchases<small>Goods bought for resale (see Note 2)</small></td><td className="n">{neg(st.stock)}</td></tr>
              <tr className="total"><td>Gross margin</td><td className="n">{n(st.gross)}</td></tr>
              <tr><td>Less: Operating expenses<small>Utilities, transport and supplies</small></td><td className="n">{neg(st.opex)}</td></tr>
              <tr className="total"><td>Net income</td><td className="n">{n(st.net)}</td></tr>
            </tbody>
          </table>

        </>
      )}

      {has("monthly") && (
        <>
          <h2>2. Monthly summary</h2>
          <table>
            <thead><tr><th>Month</th><th>Receipts</th><th>Expenses</th><th>Net</th></tr></thead>
            <tbody>
              {st.months.map((m) => (
                <tr key={m.label}><td>{m.label}</td><td className="n">{n(m.receipts)}</td><td className="n">{neg(m.expenses)}</td><td className="n">{n(m.receipts - m.expenses)}</td></tr>
              ))}
              <tr className="total"><td>Total</td><td className="n">{n(st.receipts)}</td><td className="n">{neg(st.stock + st.opex)}</td><td className="n">{n(st.net)}</td></tr>
            </tbody>
          </table>
        </>
      )}

      {has("receivables") && (
        <>
          <h2>3. Accounts receivable (credit sales to customers)</h2>
          <table>
            <thead><tr><th></th><th>Amount (PHP)</th></tr></thead>
            <tbody>
              <tr><td>Balance, {shortDate(share.dateFrom, true)}</td><td className="n">{n(st.ar.start)}</td></tr>
              <tr><td>Add: Credit sales</td><td className="n">{n(st.ar.creditSales)}</td></tr>
              <tr><td>Less: Collections</td><td className="n">{neg(st.ar.collections)}</td></tr>
              <tr className="total"><td>Balance, {shortDate(share.dateTo, true)}</td><td className="n">{n(st.ar.end)}</td></tr>
            </tbody>
          </table>
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Aging · days since sale</th><th>PHP</th></tr></thead>
            <tbody>
              <tr><td>0–30 days</td><td className="n">{n(st.ar.aging.a)}</td></tr>
              <tr><td>31–60 days</td><td className="n">{n(st.ar.aging.b)}</td></tr>
              <tr><td>61–90 days</td><td className="n">{n(st.ar.aging.c)}</td></tr>
              <tr><td>Over 90 days</td><td className="n">{n(st.ar.aging.d)}</td></tr>
              <tr className="total"><td>Total<small>Owed by {st.ar.customers} customers. Customer names are withheld.</small></td><td className="n">{n(st.ar.end)}</td></tr>
            </tbody>
          </table>
        </>
      )}

      {has("cash_flow") && (
        <>
          <h2>4. Record completeness</h2>
          <table>
            <tbody>
              <tr><td>Days with recorded entries</td><td className="n">{st.completeness.daysWithEntries} of {st.days}</td></tr>
              <tr><td>Entries recorded within 2 days of the sale<small>Older days were copied in from the owner's notebook</small></td><td className="n">{st.completeness.onTimeShare}%</td></tr>
              <tr><td>Corrected or voided entries</td><td className="n">{st.completeness.voided}</td></tr>
            </tbody>
          </table>
        </>
      )}

      <h2>Notes</h2>
      <div className="notes">
        1. Basis of preparation. Income is recognized when cash is received and expenses when cash is paid.<br />
        2. Stock purchases are presented in place of cost of goods sold because inventory is not counted at the start and end of the period.<br />
        3. Household expenses and other borrowings of the owner are not included.<br />
        4. This statement does not replace audited financial statements or financial statements filed with the Bureau of Internal Revenue.
      </div>
      <p className="notes" style={{ marginTop: 16 }}>
        Shared at the request of the business owner. Access is valid until {expires}; the owner is notified each time this statement is opened or downloaded and may withdraw access at any time.
      </p>
      {has("entries") && (
        <button className="btn ghost" style={{ width: "100%", margin: "12px 0 0" }} onClick={() => {
          store.updateShare(share.id, (s) => ({ ...s, views: [...s.views, { at: new Date().toISOString(), action: "downloaded CSV" }] }));
          downloadCsv(`${refNo(share)}-entries.csv`, entriesCsv(es, share.dateFrom, share.dateTo));
        }}>Download itemized entries (CSV)</button>
      )}
      <p className="small muted center" style={{ marginTop: 24 }}>Made with LedgeLeaf · From notebook to loan-ready.</p>
    </div>
  );
}
