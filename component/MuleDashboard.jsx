// @desc LLMule "My Key": the logged-in user's key (hidden until the eye is clicked), copy, rotate, nick, usage, ready-to-paste snippets
"use client";
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';

// The bundler reads import statements with a regex over the raw source, strings included: the
// sample code below must not contain that pattern, so it's assembled here
const JS_IMPORT = 'import OpenAI ' + 'fr' + 'om' + " 'openai';";

const me = async (body) => {
  const r = await fetch('/api/muleMe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((d.error && d.error.message) || ('Error ' + r.status));
    e.status = r.status;
    throw e;
  }
  return d;
};

const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text);
    app.ui.toast(what + ' copied', { type: 'success' });
  } catch (e) {
    app.ui.toast('Could not copy — select it by hand', { type: 'error' });
  }
};

const MuleDashboard = ({ jcontext }) => {
  const [acct, setAcct] = useState(null);
  const [err, setErr] = useState('');
  const [guest, setGuest] = useState(false);
  const [show, setShow] = useState(false);
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('python');

  useEffect(() => {
    me().then((d) => { setAcct(d); setNick(d.nick || ''); }).catch((e) => {
      if (e.status === 401) {
        setGuest(true);
        app.events.emit('mule:connect');
      } else {
        setErr(e.message);
      }
    });
  }, []);

  const rotate = async () => {
    const ok = await app.ui.confirm('Make a new key? The current one stops working right away — update your apps and your provider.');
    if (!ok) return;
    setBusy(true);
    try {
      const d = await me({ op: 'rotate' });
      setAcct(d);
      setShow(true);
      app.ui.toast('New key ready', { type: 'success' });
    } catch (e) {
      app.ui.toast(e.message, { type: 'error' });
    }
    setBusy(false);
  };

  const saveNick = async () => {
    setBusy(true);
    try {
      const d = await me({ op: 'setNick', nick: nick });
      setAcct(d);
      setNick(d.nick || '');
      app.ui.toast('Nick saved', { type: 'success' });
    } catch (e) {
      app.ui.toast(e.message, { type: 'error' });
    }
    setBusy(false);
  };

  if (guest) {
    return (
      <div className="mule-white" style={{ textAlign: 'center', padding: 30 }}>
        <p className="mule-p" style={{ fontSize: 15 }}><b>Connect to see your API key.</b></p>
        <p className="mule-p mule-muted">Free. Just an email and a 6-digit code. Used LLMule before? Same email, same key.</p>
        <button className="mule-btn primary" style={{ marginTop: 8 }} onClick={() => app.events.emit('mule:connect')}>Connect</button>
      </div>
    );
  }
  if (err) return <div className="mule-white">Couldn't load your account: {err}. <a className="mule-a" href="/dashboard">Retry</a></div>;
  if (!acct) return <div className="mule-white">Loading your account<span className="mule-blink">…</span></div>;

  const key = acct.apiKey;
  const shown = show ? key : key.slice(0, 8) + '•'.repeat(24);
  const snippets = {
    python: `from openai import OpenAI

client = OpenAI(base_url="https://api.llmule.xyz/v1", api_key="${shown}")
r = client.chat.completions.create(model="auto", messages=[{"role": "user", "content": "Hi!"}])
print(r.choices[0].message.content)`,
    javascript: `${JS_IMPORT}

const client = new OpenAI({ baseURL: 'https://api.llmule.xyz/v1', apiKey: '${shown}' });
const r = await client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi!' }] });
console.log(r.choices[0].message.content);`,
    curl: `curl https://api.llmule.xyz/v1/chat/completions \\
  -H "Authorization: Bearer ${shown}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hi!"}]}'`,
    'any app': `Base URL:  https://api.llmule.xyz/v1
API key:   ${shown}
Model:     auto`,
  };
  const realSnippet = (t) => snippets[t].split(shown).join(key);
  const pct = Math.min(100, Math.round((acct.today / acct.dailyLimit) * 100));

  return (
    <div>
      <div className="mule-grid2">
        <div className="mule-box">
          <span className="legend">Your API key</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
            <input className="mule-input" readOnly value={shown} style={{ flex: 1, minWidth: 0, fontFamily: '"Lucida Console", monospace', fontSize: 12 }} />
            <button className="mule-btn" onClick={() => setShow(!show)} title={show ? 'Hide' : 'Show'} style={{ padding: '2px 8px' }}>
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button className="mule-btn" onClick={() => copy(key, 'Key')} title="Copy" style={{ padding: '2px 8px' }}>
              <Copy size={14} />
            </button>
          </div>
          <p className="mule-p mule-muted" style={{ fontSize: 11 }}>
            Same key to use models and to share yours. Keep it private.
          </p>
          <button className="mule-btn" onClick={rotate} disabled={busy}><RefreshCw size={13} /> New key</button>
        </div>

        <div className="mule-box">
          <span className="legend">Your nick</span>
          <p className="mule-p" style={{ marginTop: 0 }}>
            How you show up in the network and on the leaderboard. People can ask for <code>{(acct.nick || 'nick') + '/model'}</code> to use your machines.
          </p>
          <div style={{ display: 'flex', gap: 4 }}>
            <input className="mule-input" value={nick} maxLength={20} placeholder="3–20: a-z 0-9 _ -"
              onChange={(e) => setNick(e.target.value.toLowerCase())} style={{ flex: 1, minWidth: 0 }} />
            <button className="mule-btn" onClick={saveNick} disabled={busy || !nick || nick === acct.nick}>Save</button>
          </div>
          <p className="mule-p mule-muted" style={{ fontSize: 11 }}>{acct.email} — never shown to anyone.</p>
        </div>
      </div>

      <div className="mule-box">
        <span className="legend">Statistics</span>
        <div className="mule-grid3">
          <div>
            <div className="mule-muted" style={{ fontSize: 11 }}>Today</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{acct.today} / {acct.dailyLimit}</div>
            <div className="mule-white" style={{ padding: 2, height: 14, marginTop: 4 }}>
              <div style={{ width: pct + '%', height: '100%', background: 'repeating-linear-gradient(90deg, #316ac5 0 8px, transparent 8px 10px)' }} />
            </div>
          </div>
          <div>
            <div className="mule-muted" style={{ fontSize: 11 }}>Answers received (all time)</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{acct.uses}</div>
          </div>
          <div>
            <div className="mule-muted" style={{ fontSize: 11 }}>Answers you served to others</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{acct.served}</div>
          </div>
        </div>
      </div>

      <div className="mule-box">
        <span className="legend">Connect your tools</span>
        <div style={{ display: 'flex', gap: 2, marginBottom: -2, position: 'relative' }}>
          {Object.keys(snippets).map((t) => (
            <button key={t} className="mule-btn" onClick={() => setTab(t)}
              style={{ padding: '2px 10px', fontWeight: tab === t ? 'bold' : 'normal', borderBottomColor: tab === t ? '#d4d0c8' : undefined }}>
              {t}
            </button>
          ))}
        </div>
        <code className="mule-code">{snippets[tab]}</code>
        <div style={{ marginTop: 6 }}>
          <button className="mule-btn" onClick={() => copy(realSnippet(tab), 'Snippet')}><Copy size={13} /> Copy with my key</button>
        </div>
      </div>

      <div className="mule-box">
        <span className="legend">Share your GPU</span>
        <p className="mule-p" style={{ marginTop: 0 }}>
          Run this on the machine with the GPU. Setup will ask for the key above. <a className="mule-a" href="/docs#share">Details</a>
        </p>
        <code className="mule-code">{`curl -fsSLo mule-provider.mjs \\
  https://raw.githubusercontent.com/andycufari/llmule/main/mule-provider.mjs
node mule-provider.mjs setup`}</code>
      </div>
    </div>
  );
};

export default MuleDashboard;
