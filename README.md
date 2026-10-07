# cloudflare-ai-experimentation

Personal experiment with Cloudflare Workers AI, Workflows, Durable Objects, and a chat UI.

The demo reads synthetic CVs and application text and flags fraud signals: prompt injection, and writing that looks fabricated or model-generated.

**Demo only.** Do not submit real personal data.

## Stack

- TypeScript + Zod
- Cloudflare Workers
- Workers AI (Llama 3.3)
- Workflows / Durable Objects for coordination and session memory
- Chat UI via Pages or a Worker-served front end

See [`AGENTS.md`](./AGENTS.md) for coding-agent rules.

## Docs

Platform reference: [Cloudflare Developers](https://developers.cloudflare.com/)

## Status

Scaffolding next.
