// @desc LLMule model page (/m/nick/model): header + tabs Chat (try it) · About (owner's card, measured stats, code; owner edits in place) · Feedback (comments)
"use client";
import React, { useState, useEffect } from 'react';
import { ThumbsUp, Copy, Pencil, Link2, Trash } from 'lucide-react';
import CardMarkdown from '@/components/framework/utils/MarkdownView';
import MuleChatRoom from './MuleChatRoom';
// ./MuleChatRoom is inlined into this file by the bundler: no top-level name here may repeat one of its

// Written by a stranger: CardMarkdown (MarkdownView) sanitizes HTML, and images become links (an <img> would leak the reader's IP)
const cardSafeMarkdown = (text) => String(text || '').replace(/!\[/g, '[');

const CARD_CSS = `
.mule-card-md { line-height: 1.55; }
.mule-card-md p { margin: 6px 0; }
.mule-card-md ul { list-style: disc; padding-left: 22px; margin: 6px 0; }
.mule-card-md ol { list-style: decimal; padding-left: 22px; margin: 6px 0; }
.mule-card-md h1, .mule-card-md h2, .mule-card-md h3 { font-weight: bold; color: #0a246a; margin: 12px 0 4px; font-size: 14px; }
.mule-card-md code { font-family: "Lucida Console", monospace; font-size: 12px; background: #eee; padding: 0 3px; }
.mule-card-md pre { background: #f6f5f1 !important; color: #1a1a1a; padding: 8px 10px; overflow-x: auto; border: 1px solid #808080; }
.mule-card-md pre code { background: none; color: #1a1a1a; }
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
/* Classic tabs: inactive ones sit lower, behind the panel's top edge; the active one is taller, overlaps that
   edge by 2px and blends into the panel */
.mule-tabs { display: flex; align-items: flex-end; margin-top: 10px; padding-left: 4px; position: relative; z-index: 2; }
.mule-tab { padding: 3px 12px; background: #d4d0c8; border: 2px solid; border-color: #fff #404040 transparent #fff;
  border-bottom: 0; border-radius: 3px 3px 0 0; font: inherit; cursor: pointer; color: #000; position: relative; }
.mule-tab.on { font-weight: bold; padding: 5px 14px 6px; margin: 0 -2px -2px; z-index: 3; }
.mule-tabpane { position: relative; z-index: 1; border: 2px solid; border-color: #fff #404040 #404040 #fff; padding: 10px; background: #d4d0c8; }
.mule-comment { padding: 8px 0; border-bottom: 1px dotted #c0c0c0; }
.mule-comment:last-child { border-bottom: 0; }
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

const fb = async (body) => {
  const r = await fetch('/api/muleFeedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || ('Error ' + r.status));
  return d;
};

const TABS = ['chat', 'about', 'feedback'];

const MuleModelCard = (props) => {
  const ok = (v) => typeof v === 'string' && v && v.indexOf('{{') === -1;
  const nick = ok(props.nick) ? props.nick : '';
  let model = ok(props.model) ? props.model : '';
  try { model = decodeURIComponent(model); } catch (e) { /* keep it as it came */ }
  const [card, setCard] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('chat');
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ title: '', hardware: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!nick || !model) { setErr('No model in the address'); return; }
    call({ nick: nick, model: model }).then((c) => {
      setCard(c);
      // #about / #feedback in the link opens that tab; an offline model opens on About (the chat can't answer)
      const h = (window.location.hash || '').slice(1);
      if (TABS.indexOf(h) !== -1) setTab(h);
      else if (!c.online) setTab('about');
    }).catch((e) => setErr(e.message));
    fb({ nick: nick, model: model }).then((d) => setComments(d.comments || [])).catch(() => setComments([]));
  }, []);

  const go = (t) => {
    setTab(t);
    try { window.history.replaceState(null, '', t === 'chat' ? window.location.pathname : '#' + t); } catch (e) { /* fine */ }
  };

  const loggedIn = () => !!(app.auth && app.auth.user);

  const like = async () => {
    if (!loggedIn()) { app.events.emit('mule:connect'); return; }
    setBusy(true);
    try { setCard(await call({ op: 'like', nick: nick, model: model })); } catch (e) { app.ui.toast(e.message, { type: 'error' }); }
    setBusy(false);
  };

  const startEdit = () => {
    setForm({ title: card.title || '', hardware: card.hardware || '', description: card.description || '' });
    setEdit(true);
    go('about');
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

  const post = async () => {
    if (!loggedIn()) { app.events.emit('mule:connect'); return; }
    setBusy(true);
    try {
      const d = await fb({ op: 'post', nick: nick, model: model, text: draft });
      setComments(d.comments || []);
      setDraft('');
    } catch (e) {
      app.ui.toast(e.message, { type: 'error' });
    }
    setBusy(false);
  };

  const remove = async (id) => {
    const yes = await app.ui.confirm('Delete this comment?');
    if (!yes) return;
    try {
      await fb({ op: 'delete', id: id });
      setComments((cur) => cur.filter((c) => c.id !== id));
    } catch (e) {
      app.ui.toast(e.message, { type: 'error' });
    }
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
    ? { color: '#2e7d32', text: 'Online' }
    : { color: '#9e9e9e', text: 'Offline — last seen ' + ago(card.lastSeenMs) };
  const nComments = comments ? comments.length : 0;

  return (
    <div>
      <style>{CARD_CSS}</style>
      <div className="mule-white" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 className="mule-h1" style={{ marginBottom: 2, wordBreak: 'break-word' }}>{card.title || card.model}</h1>
            <div className="mule-muted" style={{ fontSize: 12 }}>
              <code>{card.id}</code> · shared by <b>{card.nick}</b>
              {card.hardware && <> · {card.hardware}</>}
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <span className="mule-dot" style={{ background: status.color }} />{status.text}
              {card.tokPerSec && <span className="mule-muted"> · ~{card.tokPerSec} tok/s</span>}
              {card.answered > 0 && <span className="mule-muted"> · {card.answered} answers</span>}
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

      <div className="mule-tabs" role="tablist">
        <button className={'mule-tab' + (tab === 'chat' ? ' on' : '')} onClick={() => go('chat')} role="tab">Chat</button>
        <button className={'mule-tab' + (tab === 'about' ? ' on' : '')} onClick={() => go('about')} role="tab">About</button>
        <button className={'mule-tab' + (tab === 'feedback' ? ' on' : '')} onClick={() => go('feedback')} role="tab">
          Feedback{nComments ? ' (' + nComments + ')' : ''}
        </button>
      </div>

      <div className="mule-tabpane">
        {/* Kept mounted: switching tabs doesn't lose the conversation */}
        <div style={{ display: tab === 'chat' ? 'block' : 'none' }}>
          {!card.online && (
            <p className="mule-p" style={{ marginTop: 0 }}><b>Offline right now</b> — the machine sharing it is off. Messages will fail until it's back.</p>
          )}
          <MuleChatRoom lock={card.id} />
        </div>

        {tab === 'about' && (
          <div>
            <div className="mule-facts">
              <div><div className="k">Hardware</div><div className="v" title={card.hardware}>{card.hardware || '—'}</div></div>
              <div><div className="k">Speed (measured)</div><div className="v">{card.tokPerSec ? '~' + card.tokPerSec + ' tok/s' : '—'}</div></div>
              <div><div className="k">Answers served</div><div className="v">{card.answered}</div></div>
              <div><div className="k">Use it as</div><div className="v"><code>"{card.id}"</code></div></div>
            </div>

            {edit ? (
              <div className="mule-box">
                <span className="legend">Edit your card</span>
                <p className="mule-p" style={{ marginTop: 0 }}>
                  What is it, how did you make it, what is it good (or hilariously bad) at? Links to the weights or the code are welcome. Markdown works; images show as links.
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
                    placeholder={'Trained from scratch on…\nBase model, size, data, what makes it different.\nWeights: https://huggingface.co/…\nWhat kind of feedback you want.'}
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
                    <CardMarkdown content={cardSafeMarkdown(card.description)} prose={false} codeHighlight="basic" />
                  </div>
                ) : (
                  <p className="mule-p mule-muted" style={{ marginTop: 0 }}>
                    {card.isOwner
                      ? 'Nothing here yet. Tell people what this model is — how you trained it, on what, where the weights are, and what feedback you want.'
                      : card.nick + " hasn't written anything about this model yet."}
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
        )}

        {tab === 'feedback' && (
          <div>
            <p className="mule-p" style={{ marginTop: 0 }}>
              Tried it? Tell <b>{card.nick}</b> what worked, what broke, what was weird. That's how a model gets better.
            </p>
            <textarea className="mule-input" rows={3} style={{ width: '100%', resize: 'vertical' }} maxLength={1000} value={draft}
              placeholder={loggedIn() ? 'Your feedback (plain text, up to 1000 characters)' : 'Connect to leave feedback'}
              onChange={(e) => setDraft(e.target.value)} onFocus={() => { if (!loggedIn()) app.events.emit('mule:connect'); }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="mule-btn primary" onClick={post} disabled={busy || draft.trim().length < 2}>Post</button>
            </div>
            <div className="mule-white" style={{ marginTop: 8, padding: '4px 12px' }}>
              {!comments && <p className="mule-p">Loading<span className="mule-blink">…</span></p>}
              {comments && comments.length === 0 && <p className="mule-p mule-muted">No feedback yet. Be the first.</p>}
              {comments && comments.map((c) => (
                <div key={c.id} className="mule-comment">
                  <div style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <b style={{ color: c.isOwnerOfModel ? '#2e7d32' : '#0a246a' }}>{c.nick}</b>
                    {c.isOwnerOfModel && <span className="mule-tag">shares this model</span>}
                    <span className="mule-muted">{ago(c.createdMs)}</span>
                    <span style={{ flex: 1 }} />
                    {c.canDelete && (
                      <button className="mule-btn" style={{ padding: '0 6px' }} onClick={() => remove(c.id)} title="Delete"><Trash size={12} /></button>
                    )}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, marginTop: 2 }}>{c.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MuleModelCard;
