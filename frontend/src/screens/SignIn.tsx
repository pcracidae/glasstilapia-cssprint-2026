// Sign in: splash, language, sign up by phone or email, a 6-digit code,
// then a 4-digit PIN. Returning owners unlock with their PIN.
// There's no SMS or email service yet: the demo code is shown on screen.

import { useEffect, useState } from "react";
import { STORE, store, type Account } from "../data";
import { Icon } from "../icons";

const DEMO_CODE = "482913";

export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 1400);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <div className="splash" onClick={onDone}>
      <div className="logo"><Icon name="leaf" size={40} /></div>
      <h1>LedgeLeaf</h1>
      <div className="muted">From notebook to loan-ready.</div>
    </div>
  );
}

function Digits({ value, length, mask, onChange, autoFocus = true }: {
  value: string; length: number; mask?: boolean; onChange: (v: string) => void; autoFocus?: boolean;
}) {
  return (
    <div className="digits">
      {Array.from({ length }, (_, i) => (
        <span key={i} className={i === value.length ? "cur" : ""}>
          {value[i] ? (mask ? "●" : value[i]) : ""}
        </span>
      ))}
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        value={value}
        aria-label="Code"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
      />
    </div>
  );
}

export function SignUp({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"lang" | "contact" | "code" | "pin">("lang");
  const [language, setLanguage] = useState<"en" | "tl">("en");
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("+63 917 123 4567");
  const [email, setEmail] = useState("nena.store@gmail.com");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [seconds, setSeconds] = useState(45);

  useEffect(() => {
    if (step !== "code" || seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [step, seconds]);

  const stepNo = step === "contact" ? 1 : step === "code" ? 2 : 3;
  const header = (back: () => void) => (
    <>
      <button className="back-link" onClick={back}>‹ Back</button>
      <div className="steps">{[1, 2, 3].map((n) => <i key={n} className={n <= stepNo ? "on" : ""} />)}</div>
      <div className="small muted">Step {stepNo} of 3</div>
    </>
  );

  if (step === "lang") {
    return (
      <div className="auth">
        <h1>Choose your language</h1>
        <p>Piliin ang iyong wika.</p>
        <label htmlFor="lang">Language</label>
        <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "tl")}>
          <option value="en">English</option>
          <option value="tl">Tagalog</option>
        </select>
        <button className="btn" onClick={() => setStep("contact")}>Continue</button>
      </div>
    );
  }

  if (step === "contact") {
    const ok = method === "phone" ? phone.replace(/\D/g, "").length >= 10 : /.+@.+\..+/.test(email);
    return (
      <div className="auth">
        {header(() => setStep("lang"))}
        <h1>Sign up</h1>
        <div className="segmented" style={{ borderRadius: 10, marginTop: 16 }}>
          <button className={method === "phone" ? "on" : ""} onClick={() => setMethod("phone")}>Phone number</button>
          <button className={method === "email" ? "on" : ""} onClick={() => setMethod("email")}>Email</button>
        </div>
        {method === "phone" ? (
          <>
            <label htmlFor="phone">Phone number</label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="small muted" style={{ marginTop: 6 }}>Standard SMS rates may apply.</div>
          </>
        ) : (
          <>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </>
        )}
        <button className="btn" disabled={!ok} onClick={() => { setCode(""); setSeconds(45); setStep("code"); }}>
          Send code
        </button>
        <p className="small center" style={{ marginTop: 14 }}>
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    );
  }

  if (step === "code") {
    const wrong = code.length === 6 && code !== DEMO_CODE;
    return (
      <div className="auth">
        {header(() => setStep("contact"))}
        <h1>Enter the 6-digit code</h1>
        <p>Sent to {method === "phone" ? phone : email}.</p>
        <Digits value={code} length={6} onChange={setCode} />
        {wrong && <div className="small out">That code doesn't match. Try again.</div>}
        <button className="btn" disabled={code !== DEMO_CODE} onClick={() => setStep("pin")}>Verify</button>
        <p className="small center" style={{ marginTop: 14 }}>
          {seconds > 0 ? `Didn't get the code? Resend in 0:${String(seconds).padStart(2, "0")}` : (
            <button className="back-link" onClick={() => setSeconds(45)}>Resend code</button>
          )}
        </p>
        <div className="demo-hint">Demo: no SMS is sent. Use code <b>{DEMO_CODE}</b>.</div>
      </div>
    );
  }

  return (
    <div className="auth">
      {header(() => setStep("code"))}
      <h1>Create a 4-digit PIN</h1>
      <p>Don't share it with anyone.</p>
      <Digits value={pin} length={4} mask onChange={setPin} />
      <button
        className="btn"
        disabled={pin.length !== 4}
        onClick={() => {
          const account: Account = {
            storeName: STORE.name,
            ownerName: "Nena",
            language,
            pin,
            ...(method === "phone" ? { phone } : { email }),
          };
          store.setAccount(account);
          onDone();
        }}
      >
        Save PIN
      </button>
    </div>
  );
}

export function Unlock({ account, onDone, onForgot }: { account: Account; onDone: () => void; onForgot: () => void }) {
  const [pin, setPin] = useState("");
  const wrong = pin.length === 4 && pin !== account.pin;
  useEffect(() => {
    if (pin === account.pin) onDone();
  }, [pin, account.pin, onDone]);
  return (
    <div className="auth">
      <h1>Welcome back, {account.ownerName}</h1>
      <p>Enter your PIN to open {account.storeName}.</p>
      <Digits value={pin} length={4} mask onChange={setPin} />
      {wrong && <div className="small out">Wrong PIN. Try again.</div>}
      <button className="btn" disabled={pin !== account.pin} onClick={onDone}>Unlock</button>
      <button className="text-btn" style={{ fontSize: 13 }} onClick={onForgot}>Forgot your PIN? Sign in again</button>
    </div>
  );
}
