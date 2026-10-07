# v1 ship scope

v1 is the chat demo. Realtime voice is a follow-up. It is not a v1 blocker. A build with no voice can ship.

## In v1

- Chat UI on Cloudflare Pages. The page says the demo takes synthetic text only.
- Worker HTTP edge: `POST /session/:id/message` and `POST /session/:id/clear`. The Worker starts the Workflow.
- Cloudflare Workflow, in order: Intake, Integrity, Risk summarizer.
- Integrity runs the deterministic injection and keyword scanners in parallel with the Llama 3.3 JSON pass where the runtime allows it. Zod fail-closed. Merged escalation rules run before the reply.
- Durable Object session memory with the 24-hour TTL and the clear-session control.
- Workers AI, Llama 3.3 (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), for the integrity JSON pass and the risk-summary reply.
- The four synthetic fixtures under `fixtures/`.
- Vitest for the Zod schemas, the injection fail-closed path, and the job-post-echo and false-positive guards. Those tests do not call the model.

## Not in v1

- Realtime voice. Leave it as a later flag. Do not add a voice control, a Realtime binding, or a voice test to the v1 checklist.
- A production applicant-tracking integration, a permanent CV store, login against an external HR system, and sending real personal data to a model.

## Done when

A pasted synthetic CV on the Pages chat returns a `RiskSummary` from the Workflow, the Durable Object holds only the hash, the last summary, and `expiresAt`, and Clear session drops that state.
