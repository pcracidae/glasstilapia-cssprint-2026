import { useCallback, useEffect, useState } from "react";
import { daysAgo, downloadCsv, entriesCsv, store, today, type Entry, type Share } from "./data";
import { t } from "./i18n";
import { Icon } from "./icons";
import { Contacts } from "./screens/Contacts";
import { Loan, ProgramPage } from "./screens/Loan";
import { NewEntry } from "./screens/NewEntry";
import { Overview, ProfilePanel } from "./screens/Overview";
import { ShareCheck, ShareReady, ShareSetup, Sharing, type ShareDraft } from "./screens/Share";
import { SignUp, Splash, Unlock } from "./screens/SignIn";
import { Statement } from "./screens/Statement";
import { EntryDetails, Transactions } from "./screens/Transactions";
import { BackLink, useOnline, useStoreVersion, useToast } from "./ui";

type Tab = "today" | "transactions" | "contacts" | "loan";
type Page =
  | { name: "program"; id: string }
  | { name: "sharing" }
  | { name: "share-check"; draft: ShareDraft }
  | { name: "share-ready"; share: Share }
  | { name: "privacy" };

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  useStoreVersion();
  const lenderToken = hash.match(/^#\/s\/([\w-]+)/)?.[1];
  if (lenderToken) {
    return <div className="phone" style={{ background: "#fff" }}><Statement token={lenderToken} /></div>;
  }
  return <OwnerApp />;
}

function OwnerApp() {
  const [splash, setSplash] = useState(true);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("ledgeleaf.unlocked") === "1");
  const account = store.account();
  const doneSplash = useCallback(() => setSplash(false), []);
  const unlock = useCallback(() => {
    try { sessionStorage.setItem("ledgeleaf.unlocked", "1"); } catch { /* ignore */ }
    setUnlocked(true);
  }, []);
  const lock = () => {
    try { sessionStorage.removeItem("ledgeleaf.unlocked"); } catch { /* ignore */ }
    setUnlocked(false);
  };

  if (splash && !unlocked) return <div className="phone"><Splash onDone={doneSplash} /></div>;
  if (!account) return <div className="phone"><SignUp onDone={unlock} /></div>;
  if (!unlocked) {
    return (
      <div className="phone">
        <Unlock account={account} onDone={unlock} onForgot={() => { store.setAccount(undefined); lock(); }} />
      </div>
    );
  }
  return <Main onLock={lock} />;
}

function Main({ onLock }: { onLock: () => void }) {
  const [tab, setTab] = useState<Tab>("today");
  const [contactsType, setContactsType] = useState<"customer" | "supplier">("customer");
  const [page, setPage] = useState<Page | null>(null);
  const [newEntry, setNewEntry] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [shareDraft, setShareDraft] = useState<ShareDraft | null>(null);
  const [profile, setProfile] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [toastNode, toast] = useToast();
  const online = useOnline();

  useEffect(() => {
    if (!online) return;
    if (store.syncPending()) {
      setJustSynced(true);
      const id = window.setTimeout(() => setJustSynced(false), 4000);
      return () => window.clearTimeout(id);
    }
  }, [online]);

  useEffect(() => { window.scrollTo(0, 0); }, [tab, page]);

  const go = (to: string) => {
    const [name, arg] = to.split(/:(.*)/);
    setPage(null);
    if (name === "today" || name === "transactions" || name === "loan") setTab(name);
    else if (name === "contacts") { setContactsType(arg === "supplier" ? "supplier" : "customer"); setTab("contacts"); }
    else if (name === "new") setNewEntry(true);
    else if (name === "share") setShareDraft({ lender: arg || "Bayanihan Microfinance", purpose: "Loan application", range: 30, expires: 7 });
    else if (name === "program") setPage({ name: "program", id: arg });
    else if (name === "sharing") setPage({ name: "sharing" });
    else if (name === "privacy" || name === "store-profile") setPage({ name: "privacy" });
    else if (name === "sync") toast(online ? "All entries synced." : "No signal. Entries are saved on this phone.");
    else if (name === "export") {
      downloadCsv(`ledgeleaf-entries-${daysAgo(29)}-to-${today()}.csv`, entriesCsv(store.entries(), daysAgo(29), today()));
      toast("CSV of the last 30 days downloaded");
    } else if (name === "reset") {
      if (confirm("Reset the demo? Your added entries and share links will be removed.")) {
        store.reset();
        toast("Demo data reset");
      }
    }
  };

  let body: React.ReactNode;
  if (page?.name === "program") body = <ProgramPage id={page.id} go={go} back={() => setPage(null)} />;
  else if (page?.name === "sharing") {
    body = <Sharing back={() => setPage(null)} newShare={() => go("share")} openShare={(s) => setPage({ name: "share-ready", share: s })} />;
  } else if (page?.name === "share-check") {
    body = <ShareCheck draft={page.draft} back={() => { setShareDraft(page.draft); setPage(null); }} onShared={(s) => setPage({ name: "share-ready", share: s })} />;
  } else if (page?.name === "share-ready") body = <ShareReady share={page.share} done={() => setPage({ name: "sharing" })} toast={toast} />;
  else if (page?.name === "privacy") body = <Privacy back={() => setPage(null)} />;
  else if (tab === "today") body = <Overview go={go} openEntry={setEntry} onProfile={() => setProfile(true)} />;
  else if (tab === "transactions") body = <Transactions go={go} openEntry={setEntry} online={online} justSynced={justSynced} />;
  else if (tab === "contacts") body = <Contacts key={contactsType} initial={contactsType} toast={toast} />;
  else body = <Loan go={go} />;

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: "today", icon: "home", label: "Today" },
    { id: "transactions", icon: "list", label: "Transactions" },
    { id: "contacts", icon: "contacts", label: "Contacts" },
    { id: "loan", icon: "loan", label: "Loan" },
  ];

  return (
    <div className="phone">
      <div className={`scroll ${page ? "no-tabs" : ""}`}>{body}</div>
      {!page && (
        <>
          {(tab === "transactions" || tab === "today") && (
            <button className="fab" aria-label="New entry" onClick={() => setNewEntry(true)}><Icon name="plus" size={26} /></button>
          )}
          <nav className="tabbar">
            {tabs.map((x) => (
              <button key={x.id} className={tab === x.id ? "on" : ""} onClick={() => { if (x.id === "contacts") setContactsType("customer"); setTab(x.id); }}>
                <Icon name={x.icon} size={22} />
                {t(x.label)}
              </button>
            ))}
          </nav>
        </>
      )}
      {newEntry && <NewEntry online={online} onClose={() => setNewEntry(false)} onSaved={toast} />}
      {entry && <EntryDetails entry={store.entries().find((e) => e.id === entry.id) ?? entry} onClose={() => setEntry(null)} />}
      {shareDraft && (
        <ShareSetup draft={shareDraft} onClose={() => setShareDraft(null)} onNext={(d) => { setShareDraft(null); setPage({ name: "share-check", draft: d }); }} />
      )}
      {profile && <ProfilePanel go={go} onClose={() => setProfile(false)} onLock={onLock} />}
      {toastNode}
    </div>
  );
}

function Privacy({ back }: { back: () => void }) {
  const a = store.account();
  return (
    <>
      <BackLink label="Back" onClick={back} />
      <div className="title">Who can see your data</div>
      <div className="subtitle">Only you, unless you share it.</div>
      <div className="group">Your account</div>
      <div className="kv"><span>Store</span><b>{a?.storeName}</b></div>
      <div className="kv"><span>Signed in with</span><b>{a?.phone ?? a?.email}</b></div>
      <div className="kv"><span>Language</span><b>{a?.language === "tl" ? "Tagalog" : "English"}</b></div>
      <div className="group">Our promises</div>
      <div className="rows">
        {[
          "Your records stay on this phone until you share them.",
          "You pick one lender, what they see and for how long. Stop any link any time.",
          "Lenders never see your customers' names, notes or photos.",
          "We never hold your money and never sell your data.",
          "We don't send your records to the BIR or anyone you haven't chosen.",
        ].map((p) => (
          <div key={p} className="check-row"><Icon name="shield" size={18} style={{ color: "var(--teal)" }} /><span>{p}</span></div>
        ))}
      </div>
    </>
  );
}
