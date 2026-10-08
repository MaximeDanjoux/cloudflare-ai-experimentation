import { z } from "zod";

import { FailClosed } from "./errors";

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

export const SignalHit = z
  .object({
    detected: z.boolean(),
    evidence: z.string(),
  })
  .strict();

export const ApplicationPacket = z
  .object({
    resume: z.string().trim().min(1).max(50_000),
    jobPost: z.string().trim().min(1).max(20_000).nullable(),
    applicationSignals: z.string().trim().min(1).max(10_000).nullable(),
  })
  .strict();

export const IntegrityReport = z
  .object({
    signals: z
      .object({
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
      })
      .strict(),
    risk_level: RiskLevel,
    confidence_score: z.number().min(0).max(1),
    apply_fake_profile_tag: z.boolean(),
    reasoning: z.string(),
  })
  .strict();

export const RiskSummary = z
  .object({
    risk_level: RiskLevel,
    confidence_score: z.number().min(0).max(1),
    apply_fake_profile_tag: z.boolean(),
    reply: z.string().trim().min(1).max(4_000),
    fired_signals: z.array(SignalKey),
  })
  .strict();

export const ChatMessageRequest = z
  .object({
    text: z.string().trim().min(1).max(50_000),
    jobPost: z.string().trim().min(1).max(20_000).optional(),
    applicationSignals: z.string().trim().min(1).max(10_000).optional(),
  })
  .strict();

export const SessionId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const ChatMessageResponse = z
  .object({
    sessionId: SessionId,
    summary: RiskSummary,
  })
  .strict();

export const ClearSessionResponse = z
  .object({
    cleared: z.literal(true),
  })
  .strict();

export const SessionState = z
  .object({
    packetHash: z.string().regex(/^[a-f0-9]{64}$/),
    lastReport: RiskSummary,
    expiresAt: z.string().datetime(),
  })
  .strict();

export const ScannerFindings = z
  .object({
    prompt_injection: SignalHit,
    keyword_stuffing_hidden_text: SignalHit,
  })
  .strict();

export const IntegrityStepResult = z
  .object({
    scanner: ScannerFindings,
    report: IntegrityReport,
  })
  .strict();

export const ScreeningOutput = z
  .object({
    packetHash: z.string().regex(/^[a-f0-9]{64}$/),
    summary: RiskSummary,
  })
  .strict();

export type RiskLevel = z.infer<typeof RiskLevel>;
export type SignalKey = z.infer<typeof SignalKey>;
export type SignalHit = z.infer<typeof SignalHit>;
export type ApplicationPacket = z.infer<typeof ApplicationPacket>;
export type IntegrityReport = z.infer<typeof IntegrityReport>;
export type RiskSummary = z.infer<typeof RiskSummary>;
export type ChatMessageRequest = z.infer<typeof ChatMessageRequest>;
export type ChatMessageResponse = z.infer<typeof ChatMessageResponse>;
export type ClearSessionResponse = z.infer<typeof ClearSessionResponse>;
export type SessionState = z.infer<typeof SessionState>;
export type ScannerFindings = z.infer<typeof ScannerFindings>;
export type IntegrityStepResult = z.infer<typeof IntegrityStepResult>;
export type ScreeningOutput = z.infer<typeof ScreeningOutput>;

export const SIGNAL_KEYS = SignalKey.options;

export function parseIntegrityModelText(text: string): IntegrityReport {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new FailClosed("invalid_model_json");
  }
  const parsed = IntegrityReport.safeParse(value);
  if (!parsed.success) {
    throw new FailClosed("invalid_model_json");
  }
  return parsed.data;
}

export function parseReplyText(text: string): string {
  const parsed = z.string().trim().min(1).max(4_000).safeParse(text);
  if (!parsed.success) {
    throw new FailClosed("invalid_reply");
  }
  return parsed.data;
}

export function blankSignals(): IntegrityReport["signals"] {
  const hit = { detected: false, evidence: "" };
  return {
    ai_generated_content: { ...hit },
    extreme_skill_breadth: { ...hit },
    inconsistencies: { ...hit },
    persona_red_flags: { ...hit },
    keyword_stuffing_hidden_text: { ...hit },
    prompt_injection: { ...hit },
    suspicious_name_patterns: { ...hit },
    high_value_industry_targeting: { ...hit },
    remote_only_history: { ...hit },
    unverifiable_metrics: { ...hit },
    job_post_echo: { ...hit },
  };
}

export function emptyIntegrityReport(): IntegrityReport {
  return IntegrityReport.parse({
    signals: blankSignals(),
    risk_level: "LOW",
    confidence_score: 0,
    apply_fake_profile_tag: false,
    reasoning: "",
  });
}
