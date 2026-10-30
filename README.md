<p align="center"><a href="https://llmule.xyz"><img src="assets/llmule-wordmark.png" alt="LLMule" width="460"></a></p>

# LLMule server

The server and website behind **[llmule.xyz](https://llmule.xyz)** — the underground P2P network of LLMs. People with a
GPU share the models running on their own machines; people without one use them for free through an
OpenAI-compatible API.

- **Want to share your GPU?** You need the provider: [andycufari/llmule](https://github.com/andycufari/llmule).
- **Want to use the network?** [llmule.xyz/docs](https://llmule.xyz/docs) — base URL `https://api.llmule.xyz/v1`.
- **Want to run your own network, or audit this one?** You're in the right place.

Experimental, run by hobbyists. [Discord](https://discord.gg/uM8fFz56YB) · made by [@andycufari](https://andy.cm64.io).

## How it works

```
 consumer (any OpenAI client)                         provider (someone's machine)
        │  POST /v1/chat/completions                          │  long poll (outbound only)
        ▼                                                     ▼
 ┌──────────────────────────── this server ─────────────────────────────┐
 │ muleChat ── picks an online provider, writes a job ──► mule_jobs ◄── muleProviderPoll
 │    ▲                                                     │              │
 │    └──────── waits for the answer ◄──── muleProviderResult ◄────────────┘
 └──────────────────────────────────────────────────────────────────────┘
                                                              │
                                              POST /chat/completions
                                                              ▼
                                               Ollama / LM Studio / vLLM (localhost)
```

No WebSockets, no message broker: the "P2P table" is a jobs table. A job is assigned to one provider when it's
created (the least busy among those seen in the last 30 s); if nobody picks it up in 8 s it moves to another.
The consumer waits up to 50 s. A provider is online while it keeps polling.

- `model: "auto"` → the model with the most providers; `"qwen3.8-27b"` → any provider; `"nick/qwen3.8-27b"` →
  only that user's machines. `GET /v1/models` lists all three forms.
- 200 requests per user per UTC day (`MULE_DAILY_LIMIT`), counted when the job is created.
- The answer goes back to the consumer **rebuilt** from the OpenAI fields (`choices`, `message`, `tool_calls`,
  `usage`) — a provider can't inject anything else into it.
- Serving yourself doesn't count toward the leaderboard.

**Privacy.** A provider gets `{ id, request }` — messages and settings, never the user's name, email, key or IP.
It does read the prompt. This server relays the request and the answer and, for now, keeps them in `mule_jobs`.

## Layout

This is a [JasonJS](https://github.com/andycufari/jasonjs) site (the open-source framework behind CM64 Studio):

```
function/          server functions (sandboxed JS, one exported function each)
  muleChat.js           POST /v1/chat/completions — API key or web session; limit; auto, nick/model
  muleModels.js         GET  /v1/models
  muleProviderPoll.js   provider heartbeat + long poll for a job
  muleProviderResult.js provider sends the answer (only for the job it took, only while running)
  muleMe.js             the logged-in user's account: key, rotate, nick
  muleNetwork.js        public network status: models, sources, top sharers (cached 10 s)
  muleAdmin.js          admin ops, gated by X-API-Key = env MULE_ADMIN_KEY
database/          schemas: mule_users, mule_providers, mule_jobs
component/         the website (React): MuleHome, MuleDocs, MuleDashboard, MuleChatRoom, MuleLogin, MuleChrome…
page/              routes: /, /docs, /dashboard, /chat
setting/           routes.json (/v1/* → functions), api.json (what's public), layout, auth, theme, meta
```

## Run your own

It needs a JasonJS version with `app.sleep`, `app.crypto` and working function rewrites in `setting/routes.json`.

1. Create a project on [CM64 Studio](https://cm64.studio) (or run JasonJS yourself) and push this folder with the
   `cm64` CLI (`cm64 push ./`).
2. Set `MULE_ADMIN_KEY` in `setting/.env.json` (never commit it). Optional: `MULE_DAILY_LIMIT`.
3. Point a provider at it: `LLMULE_API=https://your-domain node mule-provider.mjs setup`.

The functions only touch the framework's `app.*` API (`db`, `auth`, `sleep`, `crypto`, `cache`, `env`), so porting
them to another runtime is mostly a matter of replacing that object.

## v1

The first LLMule (2024–2025: Node + WebSocket server, desktop app, MULE token balances) is on the
[`v1`](../../tree/v1) branch and tag `v1.0`. Old API keys keep working on v2.

## License

MIT — see [LICENSE](LICENSE).
