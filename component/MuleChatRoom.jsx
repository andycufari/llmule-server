// @desc LLMule chat in the browser: pick a model from the live network, talk to it through the logged-in session
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2 } from 'lucide-react';
import MarkdownView from '@/components/framework/utils/MarkdownView';

// Markdown from a stranger's machine: no raw HTML (MarkdownView sanitizes), and images become plain links —
// an <img> would make this browser fetch the peer's URL and hand it the IP we promise it never sees
const safeMarkdown = (text) => String(text || '').replace(/!\[/g, '[');

const MD_CSS = `
.mule-md { line-height: 1.5; color: #000; }
.mule-md p { margin: 4px 0; }
.mule-md ul { list-style: disc; padding-left: 22px; margin: 4px 0; }
.mule-md ol { list-style: decimal; padding-left: 22px; margin: 4px 0; }
.mule-md h1, .mule-md h2, .mule-md h3, .mule-md h4 { font-weight: bold; color: #0a246a; margin: 10px 0 4px; font-size: 14px; }
.mule-md h1 { font-size: 17px; } .mule-md h2 { font-size: 15px; }
.mule-md code { font-family: "Lucida Console", "Courier New", monospace; font-size: 12px; background: #eeeeee; padding: 0 3px; color: #000; }
.mule-md pre { background: #f6f5f1 !important; color: #1a1a1a; padding: 8px 10px; overflow-x: auto; margin: 6px 0;
  border: 1px solid #808080; }
.mule-md pre code { background: none; color: #1a1a1a; padding: 0; }
.mule-md .markdown-code-block { position: relative; }
.mule-md .markdown-code-language { position: absolute; top: 2px; right: 6px; font-size: 10px; color: #808080; }
.mule-md a { color: #0000ee !important; text-decoration: underline; }
.mule-md blockquote { border-left: 3px solid #808080; padding-left: 8px; color: #404040; margin: 6px 0; }
.mule-md table { border-collapse: collapse; margin: 6px 0; }
.mule-md th, .mule-md td { border: 1px solid #808080; padding: 2px 6px; }
.mule-md th { background: #d4d0c8; }
.mule-md strong { font-weight: bold; } .mule-md em { font-style: italic; }
`;

const MuleChatRoom = (props) => {
  // On a model page (/m/nick/model) the chat talks to that model only
  const lock = typeof props.lock === 'string' && props.lock.indexOf('{{') === -1 ? props.lock : '';
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(lock || 'auto');
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(0);
  const [guest, setGuest] = useState(false);
  const endRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!lock) fetch('/api/muleNetwork').then((r) => r.json()).then((d) => setModels(d.models || [])).catch(() => {});
    // First visit straight to the chat: this creates the LLMule account for the logged-in email
    fetch('/api/muleMe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => { if (r.status === 401) setGuest(true); })
      .catch(() => {});
  }, []);

  // Scroll the message box only — scrollIntoView would move the whole page (the chat sits under the model card)
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [msgs, busy]);

  useEffect(() => {
    if (!busy) return;
    setWaited(0);
    const t = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;
    if (guest) {
      app.events.emit('mule:connect');
      return;
    }
    const history = msgs.filter((m) => m.role !== 'error').concat([{ role: 'user', content: content }]);
    setMsgs(msgs.concat([{ role: 'user', content: content }]));
    setText('');
    setBusy(true);
    const t0 = Date.now();
    try {
      // Same function as /v1/chat/completions; with no API key it uses this browser's login
      const r = await fetch('/api/muleChat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d.error && d.error.message) || ('Error ' + r.status));
      const choice = d.choices && d.choices[0];
      const answer = (choice && choice.message && choice.message.content) || '(empty answer)';
      setMsgs((cur) => cur.concat([{
        role: 'assistant', content: answer,
        meta: d.model + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's' + (d.usage && d.usage.completion_tokens ? ' · ' + d.usage.completion_tokens + ' tok' : ''),
      }]));
    } catch (e) {
      setMsgs((cur) => cur.concat([{ role: 'error', content: e.message }]));
    }
    setBusy(false);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div>
      <style>{MD_CSS}</style>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        {lock ? (
          <span className="mule-muted" style={{ fontSize: 11 }}>Talking to <code>{lock}</code> on a volunteer's machine.</span>
        ) : (
          <>
            <label htmlFor="mule-model">Model:</label>
            <select id="mule-model" className="mule-input" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="auto">auto — the most shared</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.id} ({m.providers} source{m.providers === 1 ? '' : 's'})</option>
              ))}
            </select>
          </>
        )}
        <span style={{ flex: 1 }} />
        <button className="mule-btn" onClick={() => setMsgs([])} disabled={busy || !msgs.length}><Trash2 size={13} /> Clear</button>
      </div>

      <div ref={boxRef} className="mule-white" style={{ height: lock ? '52vh' : '56vh', minHeight: 280, overflowY: 'auto', padding: 10 }}>
        {msgs.length === 0 && (
          <div className="mule-muted" style={{ textAlign: 'center', marginTop: '18vh' }}>
            <p className="mule-p">Say something. A volunteer's machine will answer.</p>
            {guest && (
              <p className="mule-p">
                <button className="mule-btn primary" onClick={() => app.events.emit('mule:connect')}>Connect to chat</button>
              </p>
            )}
            <p className="mule-p" style={{ fontSize: 11 }}>It reads your message but never knows who you are. Don't send secrets.</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 'bold', fontSize: 12, color: m.role === 'user' ? '#0a246a' : m.role === 'error' ? '#c62828' : '#2e7d32' }}>
              {m.role === 'user' ? 'You' : m.role === 'error' ? '⚠ Network' : 'Peer'}
              {m.meta && <span className="mule-muted" style={{ fontWeight: 'normal', fontSize: 11 }}> — {m.meta}</span>}
            </div>
            {m.role === 'assistant' ? (
              <div className="mule-md" style={{ wordBreak: 'break-word' }}>
                <MarkdownView content={safeMarkdown(m.content)} prose={false} codeHighlight="basic" />
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{m.content}</div>
            )}
          </div>
        ))}
        {busy && (
          <div className="mule-muted">Waiting for a peer<span className="mule-blink">…</span> {waited}s</div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <textarea className="mule-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
          placeholder="Type a message — Enter to send, Shift+Enter for a new line" style={{ flex: 1, resize: 'vertical' }} />
        <button className="mule-btn primary" onClick={send} disabled={busy || !text.trim()}><Send size={14} /> Send</button>
      </div>
      <p className="mule-p mule-muted" style={{ fontSize: 11 }}>
        Counts toward your 200 a day. Answers come from volunteers' machines and can be wrong. Want an API key? <a className="mule-a" href="/dashboard">My Key</a>
      </p>
    </div>
  );
};

export default MuleChatRoom;
