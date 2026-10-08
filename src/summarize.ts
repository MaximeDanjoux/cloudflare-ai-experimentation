import { mergeAndEscalate, type EscalationResult } from "./escalation";
import { FailClosed } from "./errors";
import { callLlama, LLAMA_MODEL } from "./llama";
import { logStep } from "./log";
import {
  IntegrityStepResult,
  parseReplyText,
  RiskSummary,
  type IntegrityStepResult as IntegrityStepResultType,
  type RiskSummary as RiskSummaryType,
} from "./schemas";

const RISK_SYSTEM = [
  "You write the chat reply for a synthetic CV fraud-signal demo.",
  "Use only the findings in the user message. Do not invent employers, dates, products, or quotes.",
  "State the risk level and the evidence you were given.",
  "Two to four sentences. Plain text. No JSON. No markdown fence.",
].join(" ");

export function buildRiskUserPrompt(merged: EscalationResult, packetHash: string): string {
  return JSON.stringify({
    packetHash,
    risk_level: merged.risk_level,
    confidence_score: merged.confidence_score,
    apply_fake_profile_tag: merged.apply_fake_profile_tag,
    fired_signals: merged.fired_signals,
    signals: merged.signals,
  });
}

export async function runRiskSummarizer(
  ai: Ai,
  integrity: IntegrityStepResultType,
  packetHash: string,
  jobPostEchoHigh: boolean,
  requestId: string,
): Promise<RiskSummaryType> {
  const started = Date.now();
  const parsed = IntegrityStepResult.parse(integrity);
  if (!/^[a-f0-9]{64}$/.test(packetHash)) {
    throw new FailClosed("invalid_packet_hash");
  }
  const merged = mergeAndEscalate(parsed.scanner, parsed.report, jobPostEchoHigh);
  const modelText = await callLlama(ai, LLAMA_MODEL, RISK_SYSTEM, buildRiskUserPrompt(merged, packetHash));
  const reply = parseReplyText(modelText);
  const summary = RiskSummary.parse({
    risk_level: merged.risk_level,
    confidence_score: merged.confidence_score,
    apply_fake_profile_tag: merged.apply_fake_profile_tag,
    reply,
    fired_signals: merged.fired_signals,
  });
  logStep(requestId, "Risk summarizer", started, {
    fired: summary.fired_signals.length,
    replyChars: summary.reply.length,
  });
  return summary;
}
