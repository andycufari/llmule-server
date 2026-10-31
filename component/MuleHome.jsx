// @desc LLMule home: what it is, the live network (models + sources), how to use it, how to share, the ground rules
"use client";
import React, { useState, useEffect } from 'react';

const SCRIPT = 'https://raw.githubusercontent.com/andycufari/llmule/main/mule-provider.mjs';

const MuleHome = ({ jcontext }) => {
  const [net, setNet] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/muleNetwork')
      .then((r) => r.json())
      .then((d) => { if (alive) setNet(d); })
      .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const models = (net && net.models) || [];
  const cards = (net && net.cards) || [];
  // Online models from sharers without a nick have no page
  const anon = models.filter((m) => !m.by.length);
  const cardHref = (c) => '/m/' + encodeURIComponent(c.nick) + '/' + encodeURIComponent(c.model);
  const top = ((net && net.leaderboard) || []).slice(0, 8);

  return (
    <div>
      <div className="mule-white mule-hero" style={{ padding: '18px 18px 14px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <style>{`@media (max-width: 760px) { .mule-hero-mule { width: 96px !important; height: 96px !important; } }`}</style>
        <div style={{ flex: 1, minWidth: 0 }}>
        <span className="mule-tag">EXPERIMENTAL · RUN BY HOBBYISTS</span>
        <h1 className="mule-h1" style={{ marginTop: 10 }}>The underground P2P network of LLMs.</h1>
        <p className="mule-p" style={{ fontSize: 15, maxWidth: 720 }}>
          People with GPUs share the models running on their machines with other local AI enthusiasts.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <a className="mule-btn primary" href="/dashboard">Get your free API key</a>
          <a className="mule-btn" href="/chat">Chat in the browser</a>
          <a className="mule-btn" href="/docs#share">Share your GPU</a>
        </div>
        </div>
        <img className="mule-hero-mule" src="https://cm64-ss-public.s3.amazonaws.com/67608172a31516c083602958/llmule-body-512.png" width="190" height="190" alt="The LLMule mule, carrying servers" style={{ flexShrink: 0 }} />
      </div>

      <div className="mule-grid3">
        <div className="mule-box">
          <span className="legend">Share</span>
          <p className="mule-p">Got a GPU? Lend it to the network while you're not using it. One script, no ports opened, only the models you pick.</p>
        </div>
        <div className="mule-box">
          <span className="legend">Include</span>
          <p className="mule-p">No GPU, no credit card? Use open models from the tools you already have — anything that speaks the OpenAI API.</p>
        </div>
        <div className="mule-box">
          <span className="legend">Trust</span>
          <p className="mule-p">A network of people, not a company. Peers never learn who sent a prompt. Be decent, don't send secrets, flag bad peers.</p>
        </div>
      </div>

      <div className="mule-box" id="network">
        <span className="legend">Network — models people share</span>
        <div className="mule-listwrap">
          <table className="mule-list">
            <thead>
              <tr><th style={{ width: '46%' }}>Model</th><th>Shared by</th><th>Status</th><th>👍</th><th>Speed</th></tr>
            </thead>
            <tbody>
              {!net && <tr><td colSpan={5}>Searching the network<span className="mule-blink">…</span></td></tr>}
              {net && cards.length === 0 && anon.length === 0 && (
                <tr><td colSpan={5}>Nobody is sharing right now. <a className="mule-a" href="/docs#share">Be the first source</a>.</td></tr>
              )}
              {cards.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = cardHref(c); }}>
                  <td>
                    <a className="mule-a" href={cardHref(c)}><b>{c.title || c.model}</b></a>
                    {c.title && <span className="mule-muted"> — <code>{c.model}</code></span>}
                    {c.blurb && <div style={{ fontSize: 11, marginTop: 2 }}>{c.blurb}</div>}
                  </td>
                  <td>{c.nick}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="mule-dot" style={{ background: c.online ? '#2e7d32' : '#9e9e9e' }} />{c.online ? 'online' : 'offline'}
                  </td>
                  <td>{c.likes || ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.tokPerSec ? '~' + c.tokPerSec + ' tok/s' : ''}</td>
                </tr>
              ))}
              {anon.map((m) => (
                <tr key={'anon-' + m.id}>
                  <td><b>{m.id}</b></td><td>anonymous</td>
                  <td><span className="mule-dot" style={{ background: '#2e7d32' }} />online</td><td></td><td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mule-p mule-muted" style={{ fontSize: 11 }}>
          Every model has its own page: what it is, who made it, try it there. Call it as <code>"nick/model"</code>, or ask for <code>"auto"</code> to get the most shared one.
        </p>
      </div>

      <div className="mule-grid2">
        <div className="mule-box">
          <span className="legend">Use it — any OpenAI client</span>
          <code className="mule-code">{`from openai import OpenAI

client = OpenAI(
    base_url="https://api.llmule.xyz/v1",
    api_key="llm_...",   `}<span className="c"># free, from My Key</span>{`
)
r = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hi!"}],
)
print(r.choices[0].message.content)`}</code>
          <p className="mule-p">Works with Open WebUI, Continue, LangChain, curl… <a className="mule-a" href="/docs">Docs</a></p>
        </div>
        <div className="mule-box" id="share">
          <span className="legend">Share it — Ollama, LM Studio, llama.cpp, vLLM</span>
          <code className="mule-code">{`curl -fsSLo mule-provider.mjs \\
  ${SCRIPT}
node mule-provider.mjs setup`}</code>
          <p className="mule-p">
            Setup finds your local server, you choose which models to share, done. Node 18+, no dependencies, a single file
            you can read. <a className="mule-a" href="/docs#share">What it can and can't do</a>
          </p>
        </div>
      </div>

      <div className="mule-grid2">
        <div className="mule-box">
          <span className="legend">Top sharers</span>
          <div className="mule-listwrap">
            <table className="mule-list">
              <thead><tr><th>#</th><th style={{ width: '60%' }}>Nick</th><th>Answers served</th></tr></thead>
              <tbody>
                {top.length === 0 && <tr><td colSpan={3}>No one yet. This could be you.</td></tr>}
                {top.map((u, i) => (
                  <tr key={i}><td>{i + 1}</td><td>{u.nick}</td><td>{u.served}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mule-p mule-muted" style={{ fontSize: 11 }}>Serving yourself doesn't count.</p>
        </div>
        <div className="mule-box">
          <span className="legend">Ground rules</span>
          <ul className="mule-p" style={{ paddingLeft: 18, margin: 0 }}>
            <li>The machine that answers <b>reads your prompt</b>, but never knows who you are: no name, email or IP reaches it. <b>Don't send secrets or personal data.</b></li>
            <li>A peer can be wrong, slow, or not the model it claims. Reputation and reports are coming; until then, if something looks off, <a className="mule-a" href="https://discord.gg/uM8fFz56YB" target="_blank" rel="noopener noreferrer">tell us on Discord</a>.</li>
            <li>The GPUs are volunteers': 200 requests a day per person. Share yours and the network grows.</li>
            <li>It's an experiment. Things will break. <a className="mule-a" href="https://discord.gg/uM8fFz56YB" target="_blank" rel="noopener noreferrer">Tell us</a> when they do.</li>
          </ul>
        </div>
      </div>

      <p className="mule-p mule-muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 14 }}>
        <a className="mule-a" href="https://discord.gg/uM8fFz56YB" target="_blank" rel="noopener noreferrer">Discord</a>
        {' · '}<a className="mule-a" href="https://github.com/andycufari/llmule" target="_blank" rel="noopener noreferrer">Source code</a>
        {' · '}made by <a className="mule-a" href="https://andy.cm64.io" target="_blank" rel="noopener noreferrer">@andycufari</a> at CM64 Labs.
        <br />Not affiliated with eMule — just inspired by it.
      </p>
    </div>
  );
};

export default MuleHome;
