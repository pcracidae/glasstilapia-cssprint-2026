// Loan tab: readiness card, what lenders check, programs ranked by cost to
// the owner, and a program page with terms, eligibility and papers.
// Program terms are sample data for the demo; see the product brief for
// which ones still need checking against real lender requirements.

import { readiness, store } from "../data";
import { t } from "../i18n";
import { Icon } from "../icons";
import { BackLink, Badge, useLedger } from "../ui";
import type { Go } from "./Overview";

export type Program = {
  id: string;
  name: string;
  lender: string;
  meta: string;
  partner?: boolean;
  amount: string;
  repayment: string;
  collateral: string;
  needsDays: number;
  needsMembership?: boolean;
  papers: string[];
};

export const PROGRAMS: Program[] = [
  {
    id: "p3", name: "SB Corp P3", lender: "Small Business Corporation", meta: "₱5k–₱100k · up to 2.5% a month",
    amount: "Up to ₱50,000", repayment: "Monthly, up to 12 months", collateral: "Not required", needsDays: 30,
    papers: ["Valid government-issued ID", "Barangay business clearance or DTI registration", "Mayor's permit", "Business records for the last 30 days"],
  },
  {
    id: "coop", name: "Cooperative loan", lender: "San Isidro Cooperative", meta: "Members only",
    amount: "Up to 2× your share capital", repayment: "Monthly", collateral: "Share capital", needsDays: 14, needsMembership: true,
    papers: ["Valid government-issued ID", "Membership in the cooperative", "Barangay business clearance"],
  },
  {
    id: "mfi", name: "Microfinance group loan", lender: "Bayanihan Microfinance", meta: "Weekly payments", partner: true,
    amount: "Up to ₱30,000", repayment: "Weekly, over six months", collateral: "Not required", needsDays: 7,
    papers: ["Valid government-issued ID", "Barangay business clearance or DTI registration", "Business records, upon the lender's request"],
  },
];

function status(p: Program, days: number) {
  if (p.needsMembership) return { label: "Join first", kind: "neutral" };
  if (days >= p.needsDays) return { label: "Ready", kind: "verified" };
  return { label: `${p.needsDays - days} days`, kind: "neutral" };
}

export function Loan({ go }: { go: Go }) {
  const es = useLedger();
  const r = readiness(es);
  return (
    <>
      <div className="topbar"><h1>{t("Loan")}</h1></div>
      <div className="hero-wrap">
        <div className="hero yellow" style={{ paddingBottom: 18 }}>
          <div className="label">{t("Loan readiness")}</div>
          <div className="headline">{r.daysToP3 > 0 ? `${r.daysToP3} days to P3-ready` : "P3-ready"}</div>
          <div className="small">Up to <span className="mono">₱50,000</span> at no more than 2.5% a month</div>
          <div className="progress"><i style={{ width: `${(r.daysOnTime / 30) * 100}%` }} /></div>
        </div>
      </div>
      <div className="group" style={{ marginTop: 8 }}>{t("What lenders check")}</div>
      <div className="rows">
        <div className="row">
          <Icon name={r.daysOnTime >= 30 ? "okCircle" : "clock"} style={{ color: r.daysOnTime >= 30 ? "var(--green)" : undefined }} />
          <span className="row-main">
            <div>Days logged on time</div>
            <div className="row-meta">Log within 2 days to keep your streak</div>
          </span>
          <b>{r.daysOnTime} / 30</b>
        </div>
        <div className="row">
          <Icon name={r.verifiedPct >= 80 ? "okCircle" : "clock"} style={{ color: r.verifiedPct >= 80 ? "var(--green)" : undefined }} />
          <span className="row-main">
            <div>Verified income</div>
            <div className="row-meta">Take QR Ph payments to raise it</div>
          </span>
          <b>{r.verifiedPct}% / 80%</b>
        </div>
        <div className="row">
          <Icon name={r.salesDays7 >= 6 ? "okCircle" : "clock"} style={{ color: r.salesDays7 >= 6 ? "var(--green)" : undefined }} />
          <span className="row-main">
            <div>Steady sales</div>
            <div className="row-meta">Sales on {r.salesDays7} of the last 7 days</div>
          </span>
          <b className={r.salesDays7 >= 6 ? "in" : ""}>{r.salesDays7 >= 6 ? "Good" : "Keep going"}</b>
        </div>
      </div>
      <div className="group">Programs for you · lowest cost first</div>
      <div className="rows">
        {PROGRAMS.map((p) => {
          const s = status(p, r.daysOnTime);
          return (
            <button key={p.id} className="row" onClick={() => go(`program:${p.id}`)}>
              <span className="row-main">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{p.name} {p.partner && <Badge>Partner</Badge>}</div>
                <div className="row-meta">{p.meta}</div>
              </span>
              <Badge kind={s.kind}>{s.label}</Badge>
              <Icon name="chevron" size={18} className="chev" />
            </button>
          );
        })}
      </div>
      <p className="note">Every program you may qualify for is listed, ranked by cost to you. Partner lenders are labelled.</p>
    </>
  );
}

export function ProgramPage({ id, go, back }: { id: string; go: Go; back: () => void }) {
  const es = useLedger();
  const r = readiness(es);
  const p = PROGRAMS.find((x) => x.id === id) ?? PROGRAMS[0];
  const have = store.papers();
  const daysMet = r.daysOnTime >= p.needsDays;
  return (
    <>
      <BackLink label={t("Loan")} onClick={back} />
      <div className="title">{p.name}</div>
      <div className="group">Loan terms</div>
      <div className="kv"><span>Lender</span><b>{p.lender}</b></div>
      <div className="kv"><span>Loan amount</span><b className="mono">{p.amount}</b></div>
      <div className="kv"><span>Repayment</span><b>{p.repayment}</b></div>
      <div className="kv"><span>Collateral</span><b>{p.collateral}</b></div>
      <div className="group">Eligibility</div>
      <div className="kv"><span>Records logged on time for {p.needsDays} days</span><b className={daysMet ? "in" : "muted"}>{daysMet ? "Met" : `${r.daysOnTime} / ${p.needsDays}`}</b></div>
      <div className="kv"><span>Business in operation for 3 months</span><b className="in">Met</b></div>
      {p.needsMembership && <div className="kv"><span>Cooperative member</span><b className="muted">Not yet</b></div>}
      <div className="group">Papers · tick what you have</div>
      <div className="rows">
        {p.papers.map((paper) => (
          <label key={paper} className="check-row">
            <input type="checkbox" checked={have.includes(paper)} onChange={() => store.togglePaper(paper)} />
            <span>{paper}</span>
          </label>
        ))}
      </div>
      <p className="note">No uploads: LedgeLeaf never stores your ID or documents. Your shared records stand in for bank statements.</p>
      {p.partner && <p className="note">{p.lender} is a partner lender. We receive a fee only if your loan is approved; this does not affect how programs are ranked.</p>}
      <button className="btn" disabled={!daysMet || !!p.needsMembership} onClick={() => go(`share:${p.lender}`)}>
        {daysMet ? "Proceed with application" : `Log ${p.needsDays - r.daysOnTime} more days to apply`}
      </button>
      {daysMet && <p className="note center">Next you choose what records {p.lender} can see, and for how long.</p>}
    </>
  );
}
