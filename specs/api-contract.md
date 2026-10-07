# API contract

Zod parses every HTTP body, Workflow step payload, LLM JSON string, and Durable Object state. `.strict()` on every object. Extra keys fail. Missing keys fail. Coercion is off. A failed parse does not continue with a guessed object.

Invalid HTTP bodies return 400 and a short error name. They do not echo the body. A failed Workflow step stops the run. Invalid model JSON fails the Integrity step. Invalid Durable Object state is wiped and treated as an empty session.

The schemas below are the contract. Implement them in one module and import that module at each boundary.

## Shapes

```ts
import { z } from "zod";

export const RiskLevel = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const SignalKey = z.enum([
  "ai_generated_content",
  "extreme_skill_breadth",
  "inconsistencies",
  "persona_red_flags",
  "keyword_stuffing_hidden_text",
  "prompt_injection",
  "suspicious_name_patterns",
  "high_value_industry_targeting",
  "remote_only_history",
  "unverifiable_metrics",
  "job_post_echo",
]);

export const SignalHit = z.object({
  detected: z.boolean(),
  evidence: z.string(),
}).strict();

export const ApplicationPacket = z.object({
  resume: z.string().trim().min(1).max(50_000),
  jobPost: z.string().trim().min(1).max(20_000).nullable(),
  applicationSignals: z.string().trim().min(1).max(10_000).nullable(),
}).strict();

export const IntegrityReport = z.object({
  signals: z.object({
    ai_generated_content: SignalHit,
    extreme_skill_breadth: SignalHit,
    inconsistencies: SignalHit,
    persona_red_flags: SignalHit,
    keyword_stuffing_hidden_text: SignalHit,
    prompt_injection: SignalHit,
    suspicious_name_patterns: SignalHit,
    high_value_industry_targeting: SignalHit,
    remote_only_history: SignalHit,
    unverifiable_metrics: SignalHit,
    job_post_echo: SignalHit,
  }).strict(),
  risk_level: RiskLevel,
  confidence_score: z.number().min(0).max(1),
  apply_fake_profile_tag: z.boolean(),
  reasoning: z.string(),
}).strict();

export const RiskSummary = z.object({
  risk_level: RiskLevel,
  confidence_score: z.number().min(0).max(1),
  apply_fake_profile_tag: z.boolean(),
  reply: z.string().trim().min(1).max(4_000),
  fired_signals: z.array(SignalKey),
}).strict();

export const ChatMessageRequest = z.object({
  text: z.string().trim().min(1).max(50_000),
  jobPost: z.string().trim().min(1).max(20_000).optional(),
  applicationSignals: z.string().trim().min(1).max(10_000).optional(),
}).strict();

export const ChatMessageResponse = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  summary: RiskSummary,
}).strict();

export const ClearSessionResponse = z.object({
  cleared: z.literal(true),
}).strict();

export const SessionState = z.object({
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
  lastReport: RiskSummary,
  expiresAt: z.string().datetime(),
}).strict();

export const ScannerFindings = z.object({
  prompt_injection: SignalHit,
  keyword_stuffing_hidden_text: SignalHit,
}).strict();

export const IntegrityStepResult = z.object({
  scanner: ScannerFindings,
  report: IntegrityReport,
}).strict();
```

`IntegrityReport` matches `prompts/integrity-agent.txt`. Do not add keys the prompt forbids.

## HTTP

Session id is the path segment `:id`. It matches `^[A-Za-z0-9_-]{8,64}$`. A bad id is 400.

`POST /session/:id/message` parses the JSON body with `ChatMessageRequest`.

`POST /session/:id/clear` takes no body. The response parses as `ClearSessionResponse`.

## Workflow payloads

Intake reads a `ChatMessageRequest` and writes an `ApplicationPacket`. `text` becomes `resume`. Omitted `jobPost` or `applicationSignals` become `null`. Intake does not hunt through the resume for a job post.

Integrity reads an `ApplicationPacket` and writes an `IntegrityStepResult`. The model text is parsed as JSON, then as `IntegrityReport`. Markdown fences, trailing prose, and extra keys fail the step.

The Risk summarizer reads an `IntegrityStepResult` plus the `ApplicationPacket` hash, not the resume text, and writes a `RiskSummary`. The chat reply is `RiskSummary.reply`. `POST /session/:id/message` responds with `ChatMessageResponse`.

## Durable Object state

The only stored value is `SessionState`: packet hash, last `RiskSummary`, and `expiresAt`. The hash is SHA-256 of the canonical `ApplicationPacket` JSON. The object does not store the resume, the job post, or the application signals.

## Tests

Schema tests reject an extra key, a missing key, a wrong `risk_level`, and a confidence score outside 0 to 1. One test feeds the Integrity parser a non-JSON model string and expects the step to fail closed.
