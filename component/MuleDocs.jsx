// @desc LLMule docs: API quickstart, model names, limits, errors, sharing a GPU, privacy
"use client";
import React from 'react';

// The bundler reads import statements with a regex over the raw source, strings included: the
// sample code below must not contain that pattern, so it's assembled here
const JS_IMPORT = 'import OpenAI ' + 'fr' + 'om' + " 'openai';";

const SCRIPT = 'https://raw.githubusercontent.com/andycufari/llmule/main/mule-provider.mjs';

const TOC = [
  ['quickstart', 'Quickstart'],
  ['models', 'Choosing a model'],
  ['limits', 'Limits'],
  ['errors', 'Errors'],
  ['share', 'Share your GPU'],
  ['privacy', 'Privacy & trust'],
];

const Code = ({ children }) => <code className="mule-code" style={{ margin: '6px 0 10px' }}>{children}</code>;

const MuleDocs = ({ jcontext }) => (
  <div className="mule-grid-docs" style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: 10 }}>
    <style>{`@media (max-width: 760px) { .mule-grid-docs { grid-template-columns: 1fr !important; } }`}</style>
    <aside>
      <div className="mule-listwrap">
        <table className="mule-list">
          <thead><tr><th>Contents</th></tr></thead>
          <tbody>
            {TOC.map(([id, label]) => (
              <tr key={id}><td><a href={'#' + id} style={{ color: 'inherit', textDecoration: 'none' }}>{label}</a></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>

    <div className="mule-white" style={{ minWidth: 0 }}>
      <h1 className="mule-h1">Docs</h1>
      <p className="mule-p">
        LLMule speaks the OpenAI API. If a tool lets you change the base URL, it works with LLMule:
        point it at <code>https://api.llmule.xyz/v1</code> and use your free key from <a className="mule-a" href="/dashboard">My Key</a>.
      </p>

      <h2 className="mule-h2" id="quickstart">Quickstart</h2>
      <p className="mule-p"><b>curl</b></p>
      <Code>{`curl https://api.llmule.xyz/v1/chat/completions \\
  -H "Authorization: Bearer $LLMULE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hi!"}]}'`}</Code>
      <p className="mule-p"><b>Python</b> — <code>pip install openai</code></p>
      <Code>{`from openai import OpenAI

client = OpenAI(base_url="https://api.llmule.xyz/v1", api_key="llm_...")
r = client.chat.completions.create(model="auto", messages=[{"role": "user", "content": "Hi!"}])
print(r.choices[0].message.content)`}</Code>
      <p className="mule-p"><b>JavaScript</b> — <code>npm install openai</code></p>
      <Code>{`${JS_IMPORT}

const client = new OpenAI({ baseURL: 'https://api.llmule.xyz/v1', apiKey: 'llm_...' });
const r = await client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'Hi!' }] });
console.log(r.choices[0].message.content);`}</Code>
      <p className="mule-p">
        Endpoints: <code>GET /v1/models</code> (what's online now) and <code>POST /v1/chat/completions</code>.
        Send the key as <code>Authorization: Bearer llm_...</code> or <code>x-api-key: llm_...</code>.
        If you used LLMule before 2026, your old key still works.
      </p>

      <h2 className="mule-h2" id="models">Choosing a model</h2>
      <div className="mule-listwrap">
        <table className="mule-list">
          <thead><tr><th>model</th><th>What you get</th></tr></thead>
          <tbody>
            <tr><td><code>"auto"</code></td><td>The model with the most machines sharing it right now.</td></tr>
            <tr><td><code>"qwen3.8-27b"</code></td><td>That model, from whichever machine is least busy.</td></tr>
            <tr><td><code>"nick/qwen3.8-27b"</code></td><td>That model, only from that person's machines.</td></tr>
          </tbody>
        </table>
      </div>
      <p className="mule-p">The network changes all the time: ask <code>GET /v1/models</code> or look at the <a className="mule-a" href="/#network">Network</a> list.</p>

      <h2 className="mule-h2" id="limits">Limits</h2>
      <ul className="mule-p" style={{ paddingLeft: 18 }}>
        <li><b>200 requests per day</b> per person (resets 00:00 UTC). The GPUs are volunteers'.</li>
        <li><b>No streaming yet</b> — send <code>stream: false</code> (the default).</li>
        <li>An answer has <b>50 seconds</b>. Long outputs: lower <code>max_tokens</code>. Sharers can cap it (default 4096).</li>
        <li>Supported fields: <code>messages, temperature, top_p, max_tokens, stop, seed, presence_penalty, frequency_penalty, response_format, tools, tool_choice</code>. Anything else is dropped.</li>
      </ul>

      <h2 className="mule-h2" id="errors">Errors</h2>
      <div className="mule-listwrap">
        <table className="mule-list">
          <thead><tr><th>Status</th><th>code</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>400</td><td>model_required, messages_required, stream_unsupported</td><td>Fix the request.</td></tr>
            <tr><td>401</td><td>invalid_api_key</td><td>Missing or wrong key.</td></tr>
            <tr><td>429</td><td>daily_limit</td><td>You used today's 200. Back at 00:00 UTC.</td></tr>
            <tr><td>502</td><td>provider_error</td><td>The machine that took it failed. Retry: you'll likely get another one.</td></tr>
            <tr><td>503</td><td>no_provider</td><td>Nobody is sharing that model right now.</td></tr>
            <tr><td>504</td><td>timeout</td><td>No answer in 50 s.</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mule-h2" id="share">Share your GPU</h2>
      <p className="mule-p">
        If you run Ollama, LM Studio, llama.cpp, vLLM, Jan or KoboldCpp, you can share it. You need Node 18 or newer and
        your key from <a className="mule-a" href="/dashboard">My Key</a>.
      </p>
      <Code>{`curl -fsSLo mule-provider.mjs \\
  ${SCRIPT}
node mule-provider.mjs setup     # finds your server, you pick the models
node mule-provider.mjs           # share (Ctrl+C to stop)`}</Code>
      <p className="mule-p">
        Setup saves <code>~/.llmule/provider.json</code> (readable only by you). Run it again to change models.
        While your local server is down, the script goes offline by itself instead of failing people's requests.
      </p>
      <p className="mule-p"><b>What the script can and can't do</b> — it's one file, <a className="mule-a" href="https://github.com/andycufari/llmule" target="_blank" rel="noopener noreferrer">read it on GitHub</a>:</p>
      <ul className="mule-p" style={{ paddingLeft: 18 }}>
        <li>It only makes outgoing requests to llmule.xyz. <b>It opens no port</b>; your model server stays on localhost.</li>
        <li>Each request becomes <b>one</b> call to your server's <code>/chat/completions</code>, for a model <b>you</b> picked. Other models are refused.</li>
        <li>The request is rebuilt from plain OpenAI fields: nothing can change your server's settings (context size, GPU layers, templates).</li>
        <li><code>max_tokens</code> is capped (4096 by default). It runs no tools and writes no files.</li>
        <li>Errors from your server stay in your terminal; the network only hears "upstream error".</li>
      </ul>

      <h2 className="mule-h2" id="privacy">Privacy & trust</h2>
      <ul className="mule-p" style={{ paddingLeft: 18 }}>
        <li>The machine that answers <b>reads your prompt</b>. It gets the messages and settings — never your name, email, key or IP.</li>
        <li><b>Don't send secrets, passwords or personal data.</b> Treat it like a public forum where nobody knows your name.</li>
        <li>A peer can be wrong, slow, or not the model it claims. Reputation and reports are on the way; meanwhile, flag it on <a className="mule-a" href="https://discord.gg/uM8fFz56YB" target="_blank" rel="noopener noreferrer">Discord</a>.</li>
        <li>llmule.xyz relays the request and the answer, and for now keeps them in its database. It's an experiment run by hobbyists — use it for what that's good for.</li>
        <li>All of it is open source (MIT): the <a className="mule-a" href="https://github.com/andycufari/llmule" target="_blank" rel="noopener noreferrer">provider script</a> and the <a className="mule-a" href="https://github.com/andycufari/llmule-server" target="_blank" rel="noopener noreferrer">server and this site</a>. Read it, run your own, audit it.</li>
      </ul>
    </div>
  </div>
);

export default MuleDocs;
