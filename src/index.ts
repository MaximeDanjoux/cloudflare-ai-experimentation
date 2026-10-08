import "./env";

import { FailClosed } from "./errors";
import { logStep } from "./log";
import {
  ChatMessageRequest,
  ChatMessageResponse,
  ClearSessionResponse,
  ScreeningOutput,
  SessionId,
} from "./schemas";
import { SessionDurableObject } from "./session-do";
import { ScreeningWorkflow } from "./workflow";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const WORKFLOW_WAIT_MS = 55_000;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS });
}

function errorResponse(status: number, name: string): Response {
  return json({ error: name }, status);
}

async function waitForOutput(instance: WorkflowInstance): Promise<unknown> {
  const deadline = Date.now() + WORKFLOW_WAIT_MS;
  let delay = 50;
  for (;;) {
    const status = await instance.status();
    if (status.status === "complete") {
      return status.output;
    }
    if (status.status === "errored" || status.status === "terminated") {
      throw new FailClosed("workflow_failed");
    }
    if (Date.now() >= deadline) {
      throw new FailClosed("workflow_timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 500);
  }
}

async function handleMessage(request: Request, env: Cloudflare.Env, sessionId: string): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json");
  }
  const parsed = ChatMessageRequest.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_body");
  }

  const requestId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const started = Date.now();
  try {
    const instance = await env.SCREENING.create({
      params: { requestId, request: parsed.data },
    });
    const raw = await waitForOutput(instance);
    const output = ScreeningOutput.safeParse(raw);
    if (!output.success) {
      throw new FailClosed("invalid_workflow_output");
    }
    const stub = env.SESSION.get(env.SESSION.idFromName(sessionId));
    await stub.remember(output.data.packetHash, output.data.summary);
    logStep(requestId, "message", started, { fired: output.data.summary.fired_signals.length });
    return json(ChatMessageResponse.parse({
      sessionId,
      summary: output.data.summary,
    }));
  } catch (caught) {
    const name = caught instanceof FailClosed ? caught.code : "workflow_failed";
    const status = name === "workflow_timeout" ? 504 : 502;
    logStep(requestId, "message_failed", started, { failed: 1 });
    return errorResponse(status, name);
  }
}

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response> {
    void ctx;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const message = url.pathname.match(/^\/session\/([^/]+)\/message$/);
    const clear = url.pathname.match(/^\/session\/([^/]+)\/clear$/);
    if (!message && !clear) {
      return errorResponse(404, "not_found");
    }
    if (request.method !== "POST") {
      return errorResponse(405, "method_not_allowed");
    }

    const sessionId = (message ?? clear)?.[1] ?? "";
    if (!SessionId.safeParse(sessionId).success) {
      return errorResponse(400, "invalid_session_id");
    }

    if (clear) {
      const stub = env.SESSION.get(env.SESSION.idFromName(sessionId));
      await stub.clear();
      return json(ClearSessionResponse.parse({ cleared: true }));
    }

    return handleMessage(request, env, sessionId);
  },
} satisfies ExportedHandler<Cloudflare.Env>;

export { ScreeningWorkflow, SessionDurableObject };
