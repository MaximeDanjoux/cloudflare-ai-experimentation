import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import injectionCv from "../../fixtures/fixture-prompt-injection.txt";
import worker from "../../src/index";
import { emptyIntegrityReport, ChatMessageResponse, SessionState } from "../../src/schemas";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function mockModel(): void {
  vi.spyOn(env.AI, "run").mockImplementation(async (model: string, input: unknown) => {
    expect(model).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    const messages = (input as { messages?: { content?: string }[] }).messages ?? [];
    const system = messages[0]?.content ?? "";
    if (system.includes("chat reply")) {
      return { response: "Risk level HIGH. An instruction override is present in the submitted text." };
    }
    return { response: JSON.stringify(emptyIntegrityReport()) };
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /session/:id/message", () => {
  it("returns HIGH for the injection fixture and stores only session state", async () => {
    mockModel();
    const ctx = createExecutionContext();
    const sessionId = "sessionok1";
    const response = await worker.fetch(new IncomingRequest(`http://example.com/session/${sessionId}/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: injectionCv }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = ChatMessageResponse.parse(await response.json());
    expect(body.sessionId).toBe(sessionId);
    expect(body.summary.risk_level).toBe("HIGH");

    const stub = env.SESSION.get(env.SESSION.idFromName(sessionId));
    const stored = SessionState.parse(await stub.read());
    const storedText = JSON.stringify(stored);
    expect(storedText).not.toContain("owen.harrel@example.com");
    expect(storedText).not.toContain("Ledgerline");
    expect(stored.lastReport.risk_level).toBe("HIGH");
  });

  it("returns 400 for a bad body without echoing it, and 400 for a bad session id", async () => {
    const ctx = createExecutionContext();
    const sentinel = "SENTINEL_DO_NOT_ECHO_9f3a";
    const badBody = await worker.fetch(new IncomingRequest("http://example.com/session/sessionok1/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: sentinel, extra: true }),
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(badBody.status).toBe(400);
    const badBodyText = await badBody.text();
    expect(badBodyText).not.toContain(sentinel);
    expect(badBodyText).toContain("invalid_body");

    const badId = await worker.fetch(new IncomingRequest("http://example.com/session/short/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Synthetic CV text that is long enough." }),
    }), env, ctx);
    expect(badId.status).toBe(400);
    expect(await badId.json()).toEqual({ error: "invalid_session_id" });
  });

  it("clears a session", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(new IncomingRequest("http://example.com/session/sessionok1/clear", {
      method: "POST",
    }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cleared: true });
  });
});
