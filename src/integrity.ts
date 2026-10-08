import { clearEchoWhenJobPostMissing } from "./escalation";
import { FailClosed } from "./errors";
import { callLlama, LLAMA_MODEL } from "./llama";
import { logStep } from "./log";
import promptTemplate from "../prompts/integrity-agent.txt";
import { scanDeterministic } from "./scanners";
import {
  ApplicationPacket,
  IntegrityStepResult,
  parseIntegrityModelText,
  type ApplicationPacket as ApplicationPacketType,
  type IntegrityStepResult as IntegrityStepResultType,
} from "./schemas";

export function buildIntegrityPrompt(packet: ApplicationPacketType, currentDate: string): string {
  const parsed = ApplicationPacket.parse(packet);
  return promptTemplate
    .replaceAll("{current_date}", currentDate)
    .replaceAll("{resume_content}", parsed.resume)
    .replaceAll("{job_post_block}", parsed.jobPost ?? "")
    .replaceAll("{application_signals}", parsed.applicationSignals ?? "");
}

export async function runIntegrity(
  ai: Ai,
  packet: ApplicationPacketType,
  requestId: string,
): Promise<IntegrityStepResultType> {
  const parsed = ApplicationPacket.parse(packet);
  const started = Date.now();
  const currentDate = new Date().toISOString().slice(0, 10);
  const [scanner, modelText] = await Promise.all([
    Promise.resolve(scanDeterministic(parsed.resume)),
    callLlama(
      ai,
      LLAMA_MODEL,
      buildIntegrityPrompt(parsed, currentDate),
      "Return one JSON object and no other text.",
    ),
  ]);
  let report;
  try {
    report = parseIntegrityModelText(modelText);
  } catch (error) {
    if (error instanceof FailClosed) {
      throw error;
    }
    throw new FailClosed("invalid_model_json");
  }
  report = clearEchoWhenJobPostMissing(parsed, report);
  const result = IntegrityStepResult.parse({ scanner, report });
  logStep(requestId, "Integrity", started, {
    promptInjection: scanner.prompt_injection.detected ? 1 : 0,
    keywordStuffing: scanner.keyword_stuffing_hidden_text.detected ? 1 : 0,
  });
  return result;
}
