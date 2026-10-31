// @desc LLMule model card (/m/nick/model): what the owner says about the model, what the network measured, 👍, how to call it. The owner edits it in place
"use client";
import React, { useState, useEffect } from 'react';
import { ThumbsUp, Copy, Pencil, Link2 } from 'lucide-react';
import MarkdownView from '@/components/framework/utils/MarkdownView';

// Written by a stranger: MarkdownView sanitizes HTML, and images become links (an <img> would leak the reader's IP)
const safeMarkdown = (text) => String(text || '').replace(/!\[/g, '[');

const CARD_CSS = `
.mule-card-md { line-height: 1.55; }
.mule-card-md p { margin: 6px 0; }
.mule-card-md ul { list-style: disc; padding-left: 22px; margin: 6px 0; }
.mule-card-md ol { list-style: decimal; padding-left: 22px; margin: 6px 0; }
.mule-card-md h1, .mule-card-md h2, .mule-card-md h3 { font-weight: bold; color: #0a246a; margin: 12px 0 4px; font-size: 14px; }
.mule-card-md code { font-family: "Lucida Console", monospace; font-size: 12px; background: #eee; padding: 0 3px; }
.mule-card-md pre { background: #000 !important; color: #c0c0c0; padding: 8px 10px; overflow-x: auto; }
.mule-card-md pre code { background: none; color: #c0c0c0; }
.mule-card-md a { color: #0000ee !important; text-decoration: underline; }
.mule-card-md blockquote { border-left: 3px solid #808080; padding-left: 8px; color: #404040; }
.mule-card-md table { border-collapse: collapse; } .mule-card-md th, .mule-card-md td { border: 1px solid #808080; padding: 2px 6px; }
.mule-card-md strong { font-weight: bold; } .mule-card-md em { font-style: italic; }
.mule-facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; background: #fff; border: 2px solid; border-color: #808080 #fff #fff #808080; }
.mule-facts > div { padding: 6px 10px; border-right: 1px dotted #c0c0c0; min-width: 0; }
.mule-facts > div:last-child { border-right: 0; }
.mule-facts .k { font-size: 11px; color: #505050; }
.mule-facts .v { font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 760px) { .mule-facts { grid-template-columns: 1fr 1fr; } .mule-facts > div { border-bottom: 1px dotted #c0c0c0; } }
`;

const call = async (body) => {
  const r = await fetch('/api/muleCard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((d.error && d.error.message) || ('Error ' + r.status));
    e.status = r.status;
    throw e;
  }
  return d;
};

const ago = (ms) => {
  if (!ms) return 'never';
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return s + 's ago';
  if (s < 5400) return Math.round(s / 60) + ' min ago';
  if (s < 129600) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' days ago';
};

const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text);
    app.ui.toast(what + ' copied', { type: 'success' });
  } catch (e) {
    app.ui.toast('Could not copy — select it by hand', { type: 'error' });
  }
};

const MuleModelCard = (props) => {
  const ok = (v) => typeof v === 'string' && v && v.indexOf('{{') === -1;
  const nick = ok(props.nick) ? props.nick : '';
  let model = ok(props.model) ? props.model : '';
  try { model = decodeURIComponent(model); } catch (e) { /* keep it as it came */ }
  const [card, setCard] = useState(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ title: '', hardware: '', description: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!nick || !model) { setErr('No model in the address'); return; }
    call({ nick: nick, model: model }).then(setCard).catch((e) => setErr(e.message));
  }, []);

  const like = async () => {
    if (!(app.auth && app.auth.user)) { app.events.emit('mule:connect'); return; }
    setBusy(true);
    try { setCard(await call({ op: 'like', nick: nick, model: model })); } catch (e) { app.ui.toast(e.message, { type: 'error' }); }
    setBusy(false);
  };

  const startEdit = () => {
    setForm({ title: card.title || '', hardware: card.hardware || '', description: card.description || '' });
    setEdit(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const d = await call({ op: 'save', model: model, title: form.title, hardware: form.hardware, description: form.description });
      setCard(d);
      setEdit(false);
      app.ui.toast('Card saved', { type: 'success' });
    } catch (e) {
      app.ui.toast(e.message, { type: 'error' });
    }
    setBusy(false);
  };

  if (err) {
    return (
      <div className="mule-white" style={{ padding: 20 }}>
        <p className="mule-p"><b>{err}.</b></p>
        <p className="mule-p"><a className="mule-a" href="/#network">See what's on the network</a></p>
      </div>
    );
  }
  if (!card) return <div className="mule-white">Looking for {nick}/{model}<span className="mule-blink">…</span></div>;

  const pageUrl = 'https://llmule.xyz/m/' + encodeURIComponent(card.nick) + '/' + encodeURIComponent(card.model);
  const status = card.online
    ? { color: '#2e7d32', text: 'Online — ' + card.sources + ' machine' + (card.sources === 1 ? '' : 's') }
    : { color: '#9e9e9e', text: 'Offline — last seen ' + ago(card.lastSeenMs) };

  return (
    <div>
      <style>{CARD_CSS}</style>
      <div className="mule-white" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 className="mule-h1" style={{ marginBottom: 2, wordBreak: 'break-word' }}>{card.title || card.model}</h1>
            <div className="mule-muted">
              <code>{card.id}</code> · shared by <b>{card.nick}</b>
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <span className="mule-dot" style={{ background: status.color }} />{status.text}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {!card.isOwner && (
              <button className="mule-btn" onClick={like} disabled={busy} title={card.likedByMe ? 'Take back your 👍' : 'Like this model'}
                style={card.likedByMe ? { borderColor: '#404040 #fff #fff #404040', background: '#e6e3dc' } : undefined}>
                <ThumbsUp size={14} color={card.likedByMe ? '#1565c0' : undefined} /> {card.likes}
              </button>
            )}
            {card.isOwner && <span className="mule-btn" style={{ cursor: 'default' }}><ThumbsUp size={14} /> {card.likes}</span>}
            <button className="mule-btn" onClick={() => copy(pageUrl, 'Link')} title="Copy the link to this page"><Link2 size={14} /> Share</button>
            {card.isOwner && !edit && <button className="mule-btn primary" onClick={startEdit}><Pencil size={13} /> Edit card</button>}
          </div>
        </div>
      </div>

      <div className="mule-facts" style={{ marginTop: 8 }}>
        <div><div className="k">Hardware</div><div className="v" title={card.hardware}>{card.hardware || '—'}</div></div>
        <div><div className="k">Speed (measured)</div><div className="v">{card.tokPerSec ? '~' + card.tokPerSec + ' tok/s' : '—'}</div></div>
        <div><div className="k">Answers served</div><div className="v">{card.answered}</div></div>
        <div><div className="k">Use it as</div><div className="v"><code>"{card.id}"</code></div></div>
      </div>

      {edit ? (
        <div className="mule-box">
          <span className="legend">Edit your card</span>
          <p className="mule-p" style={{ marginTop: 0 }}>
            What is it, how did you make it, what is it good (or hilariously bad) at? Markdown works. Images show as links.
          </p>
          <label>Title<br />
            <input className="mule-input" style={{ width: '100%' }} maxLength={80} value={form.title}
              placeholder={card.model} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <div style={{ height: 8 }} />
          <label>Hardware it runs on<br />
            <input className="mule-input" style={{ width: '100%' }} maxLength={160} value={form.hardware}
              placeholder="e.g. 2× RTX 3090, Q4_K_M, 32K context" onChange={(e) => setForm({ ...form, hardware: e.target.value })} />
          </label>
          <div style={{ height: 8 }} />
          <label>Description<br />
            <textarea className="mule-input" rows={12} style={{ width: '100%', resize: 'vertical' }} maxLength={6000} value={form.description}
              placeholder={'Trained from scratch on…\nBase model, size, data, what makes it different.\nWhat kind of feedback you want.'}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="mule-muted" style={{ fontSize: 11, textAlign: 'right' }}>{form.description.length} / 6000</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="mule-btn primary" onClick={save} disabled={busy}>Save</button>
            <button className="mule-btn" onClick={() => setEdit(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mule-box">
          <span className="legend">About this model</span>
          {card.description ? (
            <div className="mule-card-md" style={{ wordBreak: 'break-word' }}>
              <MarkdownView content={safeMarkdown(card.description)} prose={false} codeHighlight="basic" />
            </div>
          ) : (
            <p className="mule-p mule-muted" style={{ marginTop: 0 }}>
              {card.isOwner
                ? 'Nothing here yet. Tell people what this model is — how you trained it, on what, and what feedback you want.'
                : card.nick + " hasn't written anything about this model yet. Try it below."}
            </p>
          )}
        </div>
      )}

      <div className="mule-box">
        <span className="legend">Call it from code</span>
        <code className="mule-code">{`curl https://api.llmule.xyz/v1/chat/completions \\
  -H "Authorization: Bearer $LLMULE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${card.id}", "messages": [{"role": "user", "content": "Hi!"}]}'`}</code>
        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="mule-btn" onClick={() => copy(card.id, 'Model id')}><Copy size={13} /> Copy model id</button>
          <span className="mule-muted" style={{ fontSize: 11 }}>
            Any OpenAI-compatible app: base URL <code>https://api.llmule.xyz/v1</code>, your key from <a className="mule-a" href="/dashboard">My Key</a>.
          </span>
        </div>
      </div>
    </div>
  );
};

export default MuleModelCard;
