import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { assessJobPostEcho } from "./escalation";
import { FailClosed } from "./errors";
import { hashPacket } from "./hash";
import { intake } from "./intake";
import { runIntegrity } from "./integrity";
import { logStep } from "./log";
import { ChatMessageRequest, ScreeningOutput, type ScreeningOutput as ScreeningOutputType } from "./schemas";
import { runRiskSummarizer } from "./summarize";

function readParams(value: unknown): { requestId: string; request: ReturnType<typeof ChatMessageRequest.parse> } {
  if (!value || typeof value !== "object") {
    throw new FailClosed("invalid_step");
  }
  const record = value as { requestId?: unknown; request?: unknown };
  if (typeof record.requestId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(record.requestId)) {
    throw new FailClosed("invalid_step");
  }
  const request = ChatMessageRequest.safeParse(record.request);
  if (!request.success) {
    throw new FailClosed("invalid_step");
  }
  return { requestId: record.requestId, request: request.data };
}

export class ScreeningWorkflow extends WorkflowEntrypoint<Cloudflare.Env, { requestId: string; request: unknown }> {
  async run(
    event: WorkflowEvent<{ requestId: string; request: unknown }>,
    step: WorkflowStep,
  ): Promise<ScreeningOutputType> {
    const params = readParams(event.payload);

    const packet = await step.do("Intake", async () => {
      const started = Date.now();
      const result = intake(params.request);
      logStep(params.requestId, "Intake", started, { resumeChars: result.resume.length });
      return result;
    });

    const integrity = await step.do("Integrity", async () => {
      return runIntegrity(this.env.AI, packet, params.requestId);
    });

    return step.do("Risk summarizer", async () => {
      const packetHash = await hashPacket(packet);
      const jobPostEchoHigh = integrity.report.signals.job_post_echo.detected
        && assessJobPostEcho(packet, integrity.report.signals.job_post_echo.evidence);
      const summary = await runRiskSummarizer(
        this.env.AI,
        integrity,
        packetHash,
        jobPostEchoHigh,
        params.requestId,
      );
      return ScreeningOutput.parse({ packetHash, summary });
    });
  }
}
