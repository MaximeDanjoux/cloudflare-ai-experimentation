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

## Status

Architecture is documented. The Worker scaffold and Workflow are not built yet.
