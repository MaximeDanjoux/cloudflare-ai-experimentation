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
| LLM | Workers AI (Llama 3.3 on Workers AI, or the current equivalent model id), unless an env-gated external provider is explicitly enabled |
| Coordination | Cloudflare Workflows and/or Workers; Durable Objects for session memory |
| UI | Chat (Pages or Worker-served HTML); voice optional later via Realtime |
| Package manager | `pnpm` preferred; `npm` acceptable for one-off Wrangler scaffolds |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` where practical |

Do not add another framework unless the user asks.

## What the demo does

The app takes synthetic CV or application text and runs a workflow:

1. Parse the text.
2. Structure it with Zod.
3. Score fraud signals.
4. Ask follow-up questions in chat.
5. Keep session memory in a Durable Object that can be wiped.

Fraud signals:

- Prompt injection in the document. Examples: "ignore previous instructions", hidden instruction overrides, text that tries to force a hire or approve result.
- Materials that look fabricated or model-written. Examples: timelines that contradict, credentials that cannot exist, stock phrasing, skills with nothing in the text to support them.

Fixtures are fictional people and obviously fake resumes. The UI and README say: Demo only. Do not submit real personal data.

## Critical rules

1. **No secrets in the repo.** API tokens and `.dev.vars` stay local or in Cloudflare secrets. Never commit `.dev.vars`, `.env`, or key material.
2. **No real personal data.** Never paste, commit, or upload real CVs, names, emails, or phone numbers. Samples stay synthetic.
3. **No personal data in logs.** Log request ids, step names, durations, and counts. Never log resume text, chat content that names a person, or model prompts and responses that include contact details.
4. **Demo retention only.** Session memory is short-lived. Prefer Durable Object state that can be wiped. Do not build a permanent document store. Document a TTL and a clear-session path.
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
  PROMPT_HISTORY.md
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
