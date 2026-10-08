import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { intake } from "../../src/intake";
import {
  ChatMessageRequest,
  emptyIntegrityReport,
  IntegrityReport,
  parseIntegrityModelText,
  RiskSummary,
  SessionState,
} from "../../src/schemas";

const report = emptyIntegrityReport();

describe("schemas fail closed", () => {
  it("rejects an extra key", () => {
    const result = IntegrityReport.safeParse({ ...report, notes: "extra" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing key", () => {
    const { reasoning: _reasoning, ...rest } = report;
    const result = IntegrityReport.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a wrong risk_level", () => {
    const result = IntegrityReport.safeParse({ ...report, risk_level: "CRITICAL" });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence score outside 0 to 1", () => {
    expect(IntegrityReport.safeParse({ ...report, confidence_score: 1.1 }).success).toBe(false);
    expect(IntegrityReport.safeParse({ ...report, confidence_score: -0.01 }).success).toBe(false);
    expect(RiskSummary.safeParse({
      risk_level: "LOW",
      confidence_score: 2,
      apply_fake_profile_tag: false,
      reply: "No signals fired.",
      fired_signals: [],
    }).success).toBe(false);
  });

  it("fails closed on a non-JSON model string", () => {
    expect(() => parseIntegrityModelText("not json")).toThrowError(/invalid_model_json/);
  });

  it("fails closed on a markdown fence and on trailing prose", () => {
    const fenced = "```json\n" + JSON.stringify(report) + "\n```";
    const trailing = JSON.stringify(report) + " thanks";
    expect(() => parseIntegrityModelText(fenced)).toThrowError(/invalid_model_json/);
    expect(() => parseIntegrityModelText(trailing)).toThrowError(/invalid_model_json/);
  });

  it("fails closed on extra keys inside model JSON", () => {
    expect(() => parseIntegrityModelText(JSON.stringify({ ...report, notes: "nope" }))).toThrowError(/invalid_model_json/);
  });

  it("accepts a valid model JSON object", () => {
    expect(parseIntegrityModelText(JSON.stringify(report)).risk_level).toBe("LOW");
  });

  it("rejects session state that is not the contract", () => {
    expect(SessionState.safeParse({
      packetHash: "zz",
      lastReport: report,
      expiresAt: "2026-10-08T00:00:00.000Z",
    }).success).toBe(false);
  });
});

describe("intake", () => {
  it("maps text to resume and omitted fields to null", () => {
    const packet = intake(ChatMessageRequest.parse({
      text: "Job post: glacier ledger.\nI built the board.",
    }));
    expect(packet.resume).toContain("Job post:");
    expect(packet.jobPost).toBeNull();
    expect(packet.applicationSignals).toBeNull();
  });

  it("keeps an explicit job post instead of hunting the resume", () => {
    const packet = intake(ChatMessageRequest.parse({
      text: "Resume body that also says job post inside it.",
      jobPost: "Own the glacier ledger reconciliation ritual.",
      applicationSignals: "Submitted twice in an hour.",
    }));
    expect(packet.jobPost).toBe("Own the glacier ledger reconciliation ritual.");
    expect(packet.resume.startsWith("Resume body")).toBe(true);
  });
});

describe("public sources", () => {
  it("binds Workers AI, the Workflow, and the Durable Object", () => {
    const toml = readFileSync(new URL("../../wrangler.toml", import.meta.url), "utf8");
    expect(toml).toContain('binding = "AI"');
    expect(toml).toMatch(/\[\[workflows\]\]/);
    expect(toml).toContain('binding = "SCREENING"');
    expect(toml).toContain('class_name = "ScreeningWorkflow"');
    expect(toml).toContain('class_name = "SessionDurableObject"');
    expect(toml).not.toMatch(/api_token|CLOUDFLARE_API_TOKEN|\.dev\.vars/);
  });

  it("uses Llama 3.3 at both model call sites", () => {
    const integrity = readFileSync(new URL("../../src/integrity.ts", import.meta.url), "utf8");
    const summarize = readFileSync(new URL("../../src/summarize.ts", import.meta.url), "utf8");
    const llama = readFileSync(new URL("../../src/llama.ts", import.meta.url), "utf8");
    expect(llama).toContain("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(integrity).toContain("LLAMA_MODEL");
    expect(summarize).toContain("LLAMA_MODEL");
    expect(integrity).toContain("callLlama");
    expect(summarize).toContain("callLlama");
  });

  it("shows the disclaimer and posts Clear session to the clear route", () => {
    const html = readFileSync(new URL("../../pages/index.html", import.meta.url), "utf8");
    expect(html).toContain("Demo only. Do not submit real personal data.");
    expect(html).toContain("Clear session");
    expect(html).toContain('const CLEAR_ROUTE = "/session/:id/clear"');
    expect(html).toContain("method: \"POST\"");
  });
});
