# AGENTS.md — cloudflare-ai-experimentation

Router for AI coding agents in this repo. Keep it short.

This repo is a personal Cloudflare experiment: a chat demo that screens synthetic CVs and application text for fraud signals. It runs on Workers AI, Workflows, and Durable Objects. It is a demo, not a system that stores real people.

Gitignored notes under `.local/` are local scratch. Tracked docs stand on their own.

## Stack (locked)

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| Validation | Zod for every external boundary (HTTP body, LLM structured output, env, DO state) |
| Runtime | Cloudflare Workers (V8 isolates; Node-compatible APIs where available via Wrangler) |
| LLM | Workers AI, Llama 3.3, for the integrity JSON pass and the risk-summary reply |
| Coordination | Workers are the HTTP edge and the Workflow entry. Cloudflare Workflows run Intake, then Integrity, then the Risk summarizer. Durable Objects hold session memory |
| UI | Chat UI on Cloudflare Pages; voice optional later via Realtime |
| Package manager | `pnpm` preferred; `npm` acceptable for one-off Wrangler scaffolds |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` where practical |

Do not add another framework unless the user asks.

## What the demo does

Cloudflare Pages serves the chat UI. The Worker accepts `POST /session/:id/message` with synthetic CV or application text. A three-step Workflow scores it. Session state stays on a Durable Object that can be wiped.

The shape is in [`ARCHITECTURE.md`](./ARCHITECTURE.md). Integrity runs deterministic injection and keyword scanners in parallel with a Llama 3.3 call that uses `prompts/integrity-agent.txt` and returns JSON. Zod parses that JSON. Invalid model JSON fails closed. Merged escalation rules then run: prompt injection becomes HIGH, and compound signals escalate. The Risk summarizer uses Llama 3.3 for the reply.

Fixtures are fictional people and obviously fake resumes. The UI and README say: Demo only. Do not submit real personal data.

## Critical rules

1. **No secrets in the repo.** API tokens and `.dev.vars` stay local or in Cloudflare secrets. Never commit `.dev.vars`, `.env`, or key material.
2. **No real personal data.** Never paste, commit, or upload real CVs, names, emails, or phone numbers. Samples stay synthetic.
3. **No personal data in logs.** Log request ids, step names, durations, and counts. Never log resume text, chat content that names a person, or model prompts and responses that include contact details.
4. **Demo retention only.** Durable Object memory lasts 24 hours, then it is wiped. The chat UI exposes Clear session. Do not build a permanent document store. See `specs/session-ttl.md`.
5. **Prefer Workers AI.** Keep inference on Cloudflare unless the user explicitly asks for an external LLM.
6. **Zod at every boundary.** Parse `env`, request bodies, tool and LLM JSON, and persisted state with Zod. Fail closed on invalid shapes.
7. **TypeScript strict.** No `any` without a one-line justification comment.
8. **Tests before relying on behaviour.** New behaviour gets a test that would fail without it.
9. **Prompt history.** `PROMPT_HISTORY.md` records prompts that changed the repo: date, goal, the prompt, and what changed. Keep entries readable. Scratch notes stay in gitignored `PROMPT_HISTORY.local.md` or `.local/`.

## Repository layout (target)

```
/
  AGENTS.md
  README.md
  ARCHITECTURE.md
  PROMPT_HISTORY.md
  prompts/integrity-agent.txt
  specs/api-contract.md
  specs/session-ttl.md
  specs/v1-ship-scope.md
  specs/deploy-path.md
  package.json
  wrangler.toml
  src/
  tests/
  fixtures/                  # synthetic CVs only
  .local/                    # gitignored
```

## Before suggesting or landing a change

- [ ] No secrets or real personal data
- [ ] No personal content in logs
- [ ] Zod schemas match the behaviour
- [ ] Types compile under `strict`
- [ ] UI still says the demo takes synthetic text only
- [ ] `PROMPT_HISTORY.md` updated when a prompt changed the repo

## Out of scope

- A production applicant-tracking integration
- A permanent store of CVs
- Login against an external HR system
- Sending real personal data to a model provider
