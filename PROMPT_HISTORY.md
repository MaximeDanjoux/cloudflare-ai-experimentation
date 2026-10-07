# Prompt history

Readable log of prompts that changed this repo. Date, goal, prompt, and what landed.

## 2026-10-07 — Bootstrap docs + multi-agent Workflow

**Goal:** Create the public coding-agent guide, README, and a small multi-agent Cloudflare Workflow for a synthetic CV fraud-signal chat demo.

**Prompt:**

Build a personal Cloudflare Workers experiment: a chat demo that screens synthetic CVs and application text for fraud signals. Flag prompt injection and writing that looks fabricated or model-generated. Demo only — never use real personal data.

Write `AGENTS.md` as a short coding-agent guide for this repo. Describe the product as a chat demo on Workers AI, Workflows, and Durable Objects that screens synthetic CVs and application text. Lock the stack to TypeScript, Zod at every external boundary (HTTP body, LLM structured output, env, Durable Object state), Cloudflare Workers, Workers AI (Llama 3.3 or the current equivalent) unless an env-gated external provider is explicitly enabled, Workflows and/or Workers, Durable Objects for session memory, a chat UI on Pages or Worker-served HTML, `pnpm` preferred, and Vitest with `@cloudflare/vitest-pool-workers` where practical. Do not add another framework unless asked.

Describe the demo flow as: parse text, structure it with Zod, score fraud signals, ask follow-ups in chat, and keep short-lived session memory in a Durable Object that can be wiped. Fraud signals are prompt injection in the document (for example “ignore previous instructions”, hidden overrides, or text that tries to force a hire or approve result) and materials that look fabricated or model-written (contradictory timelines, impossible credentials, stock phrasing, skills the text does not support). Fixtures must be fictional people and obviously fake resumes. The UI and README must say: Demo only. Do not submit real personal data.

Include these critical rules: no secrets in the repo; no real personal data; no personal data in logs (request ids, step names, durations, and counts only); demo retention only, with a TTL and a clear-session path; prefer Workers AI; Zod fail-closed; TypeScript strict with no `any` unless a one-line justification comment; tests for new behaviour; and a `PROMPT_HISTORY.md` that records prompts that changed the repo with date, goal, prompt, and what changed.

Target layout: `AGENTS.md`, `README.md`, `PROMPT_HISTORY.md`, `package.json`, `wrangler.toml`, `src/`, `tests/`, `fixtures/`. Out of scope: a production ATS integration, a permanent CV store, login against an external HR system, and sending real personal data to a model provider. Add a short before-change checklist that matches the rules above.

Write `README.md` as personal experimentation framing with stack bullets, a link to `AGENTS.md`, and the demo-only warning. Update `.gitignore` so `.dev.vars`, `.env`, and other secrets stay out of git.

Then scaffold with Wrangler and implement a small multi-agent Cloudflare Workflow with three steps. Intake parses chat or upload text into a Zod-validated structured packet. Integrity runs parallel checks for prompt injection and fabrication or LLM-lookalike signals and fails closed on invalid shapes. Risk summarizer merges findings into a scored risk summary and a short chat reply, and stores only ephemeral session state in a Durable Object with a wipeable TTL.

Prefer Workers AI for LLM calls. Add two or three synthetic fixtures under `fixtures/`. Add tests for Zod boundaries and at least one path that fails closed on injected “ignore previous instructions” text. When done, append one entry to `PROMPT_HISTORY.md` for this prompt.

Start with `AGENTS.md` and `README.md`, then scaffold and implement the workflow.

**What changed:** Added `PROMPT_HISTORY.md` with this entry. `AGENTS.md` and `README.md` already matched the docs portion; Wrangler scaffold and Workflow implementation are still pending.
