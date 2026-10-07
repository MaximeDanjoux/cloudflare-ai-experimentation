# AGENTS.md — cloudflare-ai-experimentation

> Router for AI coding agents working in this repo. Keep this file short and actionable.

This repository is **personal experimentation** with Cloudflare Workers AI, Workflows / Durable Objects, and a chat UI. Treat it as a public demo sandbox, not a production people-data system.

## Stack (locked)

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| Validation | Zod for every external boundary (HTTP body, LLM structured output, env, DO state) |
| Runtime | Cloudflare Workers (V8 isolates; Node-compatible APIs where available via Wrangler) |
| LLM | Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` or current Llama 3.3 Workers AI id), unless an env-gated external provider is explicitly enabled |
| Coordination | Cloudflare Workflows and/or Workers; Durable Objects for session memory / state |
| UI | Chat (Pages or Worker-served HTML); voice optional later via Realtime |
| Package manager | `pnpm` preferred; `npm` acceptable for one-off Wrangler scaffolds |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` where practical |

Do **not** introduce another framework stack without an explicit ask.

## Critical rules (always apply)

1. **No secrets in the repo.** API tokens, account ids that are sensitive, and `.dev.vars` stay local / Cloudflare secrets. Never commit `.dev.vars`, `.env`, or key material. Document required bindings in `wrangler.toml` / README only by name.
2. **No real personal data.** Never paste, commit, or upload real CVs, candidate names, emails, phone numbers, or employer-internal documents. Use clearly synthetic sample profiles only.
3. **No PII in logs.** Log request ids, step names, durations, and counts. Never log resume text, chat content with names/contacts, or model prompts/responses that include personal data.
4. **Demo retention only.** Session memory (Durable Object / KV) is short-lived. Prefer in-memory / DO state that can be wiped; do not build a permanent CV store. Document TTL and a “clear session” path.
5. **Prefer Workers AI.** Keep inference on Cloudflare unless the user explicitly asks for an external LLM. If an external LLM is used, gate it behind env config and never send real personal data.
6. **Zod at every boundary.** Parse `env`, request bodies, tool/LLM JSON, and persisted state with Zod. Fail closed on invalid shapes.
7. **TypeScript strict.** No `any` without a one-line justification comment. Prefer branded / discriminated unions over stringly types.
8. **Tests before relying on behaviour.** New behaviour gets a test that would fail without it. Keep `pnpm test` / `npm test` green before push when tests exist.
9. **Public-repo hygiene.** Do not mention employers, internal systems, job applications, or private product names in code, commits, README, or sample data. Frame everything as learning / experimentation.
10. **Prompt history is a first-class artefact.** AI-assisted coding is fine; keep a `PROMPT_HISTORY.md` (or `docs/prompt-history/`) updated with the prompts used to build the app, because the Cloudflare assignment asks for it.

## Product framing for this experiment

Build a **demo-safe** AI chat app that can:

1. Take **synthetic** document / profile text as input
2. Run a multi-step **workflow** (parse → structure with Zod → score/summarise → follow-up questions)
3. Keep **session memory** (prior turns + structured state) in a Durable Object
4. Expose a **chat UI**

Default domain for samples: fictional people and roles. Label the UI and README: *Demo only. Do not submit real personal data.*

## Repository layout (target)

```
/
  AGENTS.md
  README.md
  PROMPT_HISTORY.md
  package.json
  wrangler.toml
  src/
    index.ts              # Worker entry
    env.ts                # Zod-parsed env / bindings
    schemas/              # Zod schemas
    workflow/             # Workflow / step coordination
    memory/               # Durable Object session state
    llm/                  # Workers AI client + structured output
    ui/                   # Chat page assets if not using Pages separately
  tests/
  fixtures/               # Synthetic sample profiles only
```

Adjust paths if Wrangler’s scaffold differs; keep the separation of concerns.

## Before suggesting or landing a change

- [ ] No secrets, real CVs, or real contact details
- [ ] No personal content in logs
- [ ] Zod schemas updated with behaviour
- [ ] Types compile under `strict`
- [ ] Demo / synthetic-data labelling still accurate
- [ ] `PROMPT_HISTORY.md` updated if an agent wrote or rewrote substantial code
- [ ] README still reads as personal Cloudflare experimentation

## Out of scope

- Production ATS integrations
- Persistent candidate databases
- Auth to real HR systems
- Shipping real applicant data to any model provider
- Company-internal playbooks, credentials, or architecture copied from private repos

## Session handoff

When pausing work, leave a short note in `PROMPT_HISTORY.md` or a dated entry under `docs/` covering: what works, what’s broken, next concrete step, and any Cloudflare dashboard settings still needed (Workers AI binding, DO binding, Pages project).
