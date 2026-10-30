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
  const top = ((net && net.leaderboard) || []).slice(0, 8);

  return (
    <div>
      <div className="mule-white" style={{ padding: '18px 18px 14px' }}>
        <span className="mule-tag">EXPERIMENTAL · RUN BY HOBBYISTS</span>
        <h1 className="mule-h1" style={{ marginTop: 10 }}>The parallel network of LLMs.</h1>
        <p className="mule-p" style={{ fontSize: 15, maxWidth: 720 }}>
          People with a GPU share the models running on their own machines.
          People without one use them — free, through the same API as OpenAI.
          Like the P2P networks we grew up with, but for language models.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <a className="mule-btn primary" href="/dashboard">Get your free API key</a>
          <a className="mule-btn" href="/chat">Chat in the browser</a>
          <a className="mule-btn" href="/docs#share">Share your GPU</a>
        </div>
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
        <span className="legend">Network — shared right now</span>
        <div className="mule-listwrap">
          <table className="mule-list">
            <thead>
              <tr><th style={{ width: '45%' }}>Model</th><th>Sources</th><th>Shared by</th><th>Use it as</th></tr>
            </thead>
            <tbody>
              {!net && <tr><td colSpan={4}>Searching the network<span className="mule-blink">…</span></td></tr>}
              {net && models.length === 0 && (
                <tr><td colSpan={4}>Nobody is sharing right now. <a className="mule-a" href="/docs#share">Be the first source</a>.</td></tr>
              )}
              {models.map((m) => (
                <tr key={m.id}>
                  <td><b>{m.id}</b></td>
                  <td>{m.providers}</td>
                  <td>{m.by.length ? m.by.join(', ') : 'anonymous'}</td>
                  <td><code>"{m.id}"</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mule-p mule-muted" style={{ fontSize: 11 }}>
          Sources = machines serving that model. Ask for <code>"auto"</code> to get whatever is best shared, or <code>"nick/model"</code> to pick someone's machine.
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
