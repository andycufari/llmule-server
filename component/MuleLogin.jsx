// @desc LLMule "Connect" dialog: email → 6-digit code → session, in place (no redirect). Unknown emails sign up on the fly
// Open it with app.events.emit('mule:connect'). Uses the framework's email-code endpoints and its NextAuth
// "verification-code" provider, called with fetch the same way next-auth's signIn() does.
"use client";
import React, { useState, useEffect, useRef } from 'react';

const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: d };
};

// The session cookie comes from NextAuth's credentials callback
const openSession = async (email, code, type) => {
  const csrf = await fetch('/api/auth/csrf').then((r) => r.json());
  const form = new URLSearchParams({ email: email, code: code, type: type, csrfToken: csrf.csrfToken, callbackUrl: window.location.href, json: 'true' });
  const r = await fetch('/api/auth/callback/verification-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: form.toString(),
  });
  const d = await r.json().catch(() => ({}));
  return r.ok && !(d.url && d.url.indexOf('error=') !== -1);
};

const MuleLogin = ({ jcontext }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('login');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const codeRef = useRef(null);

  useEffect(() => {
    const off = app.events.on('mule:connect', () => { setOpen(true); setStep('email'); setMsg(''); });
    return () => off();
  }, []);

  useEffect(() => {
    if (step === 'code' && codeRef.current) codeRef.current.focus();
  }, [step]);

  if (!open) return null;

  const sendCode = async (e) => {
    if (e) e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { setMsg('That doesn\'t look like an email.'); return; }
    setBusy(true);
    setMsg('');
    try {
      let r;
      let t = 'login';
      if (step === 'code' && type === 'registration') {
        // Resend while signing up: the account already exists but isn't verified yet
        r = await post('/api/auth/send-verification-code', { email: addr, type: 'registration' });
        t = 'registration';
      } else {
        r = await post('/api/auth/send-login-code', { email: addr });
      }
      if (r.status === 404) {
        // New here (or an LLMule user from before 2026): create the account, it sends the code too
        r = await post('/api/auth/register', { email: addr });
        t = 'registration';
      }
      if (!r.ok) throw new Error(r.data.error || ('Error ' + r.status));
      setEmail(addr);
      setType(t);
      setCode('');
      setStep('code');
    } catch (err) {
      setMsg(err.message);
    }
    setBusy(false);
  };

  const connect = async (e) => {
    if (e) e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setMsg('The code has 6 digits.'); return; }
    setBusy(true);
    setMsg('');
    try {
      if (await openSession(email, code, type)) {
        setStep('done');
        window.location.reload();
        return;
      }
      setMsg('Wrong or expired code. Check the latest email, or send a new one.');
    } catch (err) {
      setMsg(err.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
      <div className="mule-win" style={{ width: '100%', maxWidth: 420, margin: 0 }} role="dialog" aria-label="Connect to LLMule">
        <div className="mule-title">
          <span className="t">Connect to LLMule</span>
          <span className="caps"><span style={{ cursor: 'pointer' }} onClick={() => { if (!busy) setOpen(false); }}>×</span></span>
        </div>
        <div style={{ padding: 14 }}>
          {step === 'email' && (
            <form onSubmit={sendCode}>
              <p className="mule-p" style={{ marginTop: 0 }}>Enter your email. We'll send you a 6-digit code — no passwords.</p>
              <p className="mule-p mule-muted" style={{ fontSize: 11 }}>Used LLMule before? Use the same email: your old key is waiting.</p>
              <label htmlFor="mule-email" style={{ display: 'block', margin: '10px 0 3px' }}>Email:</label>
              <input id="mule-email" className="mule-input" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
                <button type="button" className="mule-btn" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="mule-btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
              </div>
            </form>
          )}
          {step === 'code' && (
            <form onSubmit={connect}>
              <p className="mule-p" style={{ marginTop: 0 }}>
                {type === 'registration' ? 'Welcome! ' : ''}We sent a code to <b>{email}</b>. It can take a minute — check spam too.
              </p>
              <label htmlFor="mule-code" style={{ display: 'block', margin: '10px 0 3px' }}>Code:</label>
              <input id="mule-code" ref={codeRef} className="mule-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                style={{ width: '100%', fontFamily: '"Lucida Console", monospace', fontSize: 20, letterSpacing: 8, textAlign: 'center' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="mule-btn" onClick={() => { setStep('email'); setMsg(''); }} disabled={busy}>Back</button>
                  <button type="button" className="mule-btn" onClick={() => sendCode()} disabled={busy}>Resend</button>
                </span>
                <button type="submit" className="mule-btn primary" disabled={busy || code.length !== 6}>{busy ? 'Connecting…' : 'Connect'}</button>
              </div>
            </form>
          )}
          {step === 'done' && <p className="mule-p">Connected. Loading your stuff<span className="mule-blink">…</span></p>}
          {msg && <p className="mule-p" style={{ color: '#c62828', marginBottom: 0 }}>{msg}</p>}
        </div>
      </div>
    </div>
  );
};

export default MuleLogin;
