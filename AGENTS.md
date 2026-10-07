# AGENTS.md — cloudflare-ai-experimentation

> Router for AI coding agents working in this repo. Keep this file short and actionable.

This repository is **personal experimentation** with Cloudflare Workers AI, Workflows / Durable Objects, and a chat UI. Treat it as a public demo sandbox, not a production people-data system.

Local-only overrides (if present) live in gitignored paths such as `.local/AGENTS.local.md`. Those files are never part of the public tree. When local overrides exist, they win over this file for private intent; this file still governs anything that may be committed.

## Stack (locked)

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| Validation | Zod for every external boundary (HTTP body, LLM structured output, env, DO state) |
| Runtime | Cloudflare Workers (V8 isolates; Node-compatible APIs where available via Wrangler) |
| LLM | Workers AI (Llama 3.3 on Workers AI, or current equivalent model id), unless an env-gated external provider is explicitly enabled |
| Coordination | Cloudflare Workflows and/or Workers; Durable Objects for session memory / state |
| UI | Chat (Pages or Worker-served HTML); voice optional later via Realtime |
| Package manager | `pnpm` preferred; `npm` acceptable for one-off Wrangler scaffolds |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` where practical |

Do **not** introduce another framework stack without an explicit ask.

## Critical rules (always apply)

1. **No secrets in the repo.** API tokens and `.dev.vars` stay local / Cloudflare secrets. Never commit `.dev.vars`, `.env`, or key material.
2. **No real personal data.** Never paste, commit, or upload real CVs, candidate names, emails, phone numbers, or employer-internal documents. Use clearly synthetic sample profiles only.
3. **No PII in logs.** Log request ids, step names, durations, and counts. Never log resume text, chat content with names/contacts, or model prompts/responses that include personal data.
4. **Demo retention only.** Session memory is short-lived. Prefer Durable Object state that can be wiped; do not build a permanent document store. Document TTL and a clear-session path.
5. **Prefer Workers AI.** Keep inference on Cloudflare unless the user explicitly asks for an external LLM.
6. **Zod at every boundary.** Parse `env`, request bodies, tool/LLM JSON, and persisted state with Zod. Fail closed on invalid shapes.
7. **TypeScript strict.** No `any` without a one-line justification comment.
8. **Tests before relying on behaviour.** New behaviour gets a test that would fail without it.
9. **Public-repo hygiene.** Do not mention employers, internal systems, or private product names in committed code, samples, or docs. Frame everything as learning / experimentation.
10. **Submission-safe prompt history.** Committed `PROMPT_HISTORY.md` must be sanitized: no private intent, no private repo names, no real prompts that reveal hidden strategy. Full raw prompt logs belong only in gitignored `PROMPT_HISTORY.local.md` / `.local/`.

## Product framing for this experiment

Build a **demo-safe** AI chat app that:

1. Takes **synthetic** document text as input
2. Runs a multi-step **workflow** (parse → structure with Zod → risk signals → follow-up questions)
3. Keeps **session memory** in a Durable Object
4. Exposes a **chat UI**

Default domain: fictional profiles and fabricated-document / prompt-injection defenses for a screening demo. Label the UI and README: *Demo only. Do not submit real personal data.*

## Repository layout (target)

```
/
  AGENTS.md
  README.md
  PROMPT_HISTORY.md          # sanitized, safe to submit
  package.json
  wrangler.toml
  src/
  tests/
  fixtures/                  # synthetic samples only
  .local/                    # gitignored — private agent context
```

## Before suggesting or landing a change

- [ ] No secrets or real personal data
- [ ] No personal content in logs
- [ ] Nothing private from `.local/` copied into tracked files
- [ ] Zod schemas updated with behaviour
- [ ] Types compile under `strict`
- [ ] Demo / synthetic-data labelling still accurate
- [ ] Sanitized `PROMPT_HISTORY.md` updated if needed; raw prompts only in local files

## Out of scope

- Production ATS integrations
- Persistent candidate databases
- Auth to real HR systems
- Shipping real personal data to any model provider
- Copying private playbooks, credentials, or architecture into this public tree
