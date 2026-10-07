# Architecture

Cloudflare Workflows run Intake, then Integrity, then the Risk summarizer. Workers are the HTTP edge and the Workflow entry. Zod validates every boundary. Chat memory lives in a Durable Object that can be wiped.

Workers AI runs Llama 3.3 for two calls: the integrity pass, and the risk-summary reply.

## Edge

Cloudflare Pages serves the chat UI. A Worker is the HTTP edge and the Workflow entry. It accepts `POST /session/:id/message`. Zod validates the body. The session id maps to one Durable Object. That Worker starts the Workflow.

## Orchestration

### 1. Intake

Normalize pasted or uploaded text into an `ApplicationPacket` (Zod). Split the resume, an optional job post, and application signals.

### 2. Integrity

In parallel where possible:

- Deterministic scanners for prompt-injection and keyword-stuffing patterns.
- A Workers AI Llama 3.3 call that uses the integrity-agent system prompt in `prompts/integrity-agent.txt` and returns JSON. Zod parses that JSON into an `IntegrityReport`. Invalid model JSON fails closed.

Scanner output and the `IntegrityReport` then go through the merged escalation rules. Prompt injection becomes HIGH. Compound signals escalate. Category rules and false-positive guards stay in `prompts/integrity-agent.txt`. The merge does not invent a second scoring policy.

### 3. Risk summarizer

Workers AI Llama 3.3 writes the short risk-summary reply from the merged findings. The step returns a `RiskSummary` and that reply.

The Durable Object stores only ephemeral state: a packet hash, the last report, and a 24-hour expiry. It does not keep resume text. The chat UI has a Clear session control that wipes that state immediately. Details are in [specs/session-ttl.md](./specs/session-ttl.md).

Schemas, v1 scope, and the deploy path are in [specs/api-contract.md](./specs/api-contract.md), [specs/v1-ship-scope.md](./specs/v1-ship-scope.md), and [specs/deploy-path.md](./specs/deploy-path.md).

## Storage and logs

Synthetic fixtures live in `fixtures/`.

Logs record a request id, the step, duration, and counts. Do not log or permanently store resume text.

## Tests

Vitest covers:

- Zod schemas
- The injection path that fails closed
- Job-post echo and the false-positive guards

Those tests do not call the model.
