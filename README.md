# cloudflare-ai-experimentation

Personal experiment with Cloudflare Workers AI, Workflows, Durable Objects, and a chat UI on Cloudflare Pages.

The demo reads synthetic CVs and application text and flags fraud signals: prompt injection, and writing that looks fabricated or model-generated.

**Demo only.** Do not submit real personal data.

## Stack

- TypeScript + Zod
- Cloudflare Workers
- Workers AI, Llama 3.3, for the integrity JSON pass and the risk-summary reply
- Cloudflare Workflows: Intake, then Integrity, then the Risk summarizer
- Workers as the HTTP edge and the Workflow entry
- Durable Objects for session memory
- Chat UI on Cloudflare Pages

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the Workflow, and [`AGENTS.md`](./AGENTS.md) for coding-agent rules.

## Docs

Platform reference: [Cloudflare Developers](https://developers.cloudflare.com/)

## Run

```powershell
npm install
npm test
npx wrangler dev
npx wrangler pages dev pages
```

`wrangler dev` serves `POST /session/:id/message` and `POST /session/:id/clear`. The page's Worker URL defaults to `http://127.0.0.1:8787`.

Workers AI is a remote binding. `wrangler dev` asks for a Cloudflare login before the server starts. `npx wrangler dev --local` starts without that login. Model calls are unavailable in that mode. A bad session id, a bad body, and Clear session still run.

Ship the Worker with `npx wrangler deploy`. Ship the page with `npx wrangler pages deploy pages --project-name cv-fraud-signal-demo`. `wrangler login` stays on the machine. Do not commit a token.

## Status

v1 is the chat demo: Intake, Integrity, and the Risk summarizer. Realtime voice is not in this build.
