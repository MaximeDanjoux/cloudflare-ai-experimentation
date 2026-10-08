import { describe, expect, it } from "vitest";

import { hashPacket } from "../../src/hash";
import { MemorySessionStorage, SessionMemory } from "../../src/session";
import { emptyIntegrityReport, RiskSummary, type RiskSummary as RiskSummaryType } from "../../src/schemas";

const summary: RiskSummaryType = RiskSummary.parse({
  risk_level: "HIGH",
  confidence_score: 0.4,
  apply_fake_profile_tag: true,
  reply: "Instruction override detected.",
  fired_signals: ["prompt_injection"],
});

describe("session rules", () => {
  it("stores only the hash, the last summary, and a replaced 24 hour expiry", async () => {
    const resume = "UNIQUE_RESUME_SENTINEL owns the glacier ledger.";
    const store = new MemorySessionStorage();
    let now = new Date("2026-10-08T00:00:00.000Z");
    const memory = new SessionMemory(store, () => now);
    const hash = await hashPacket({
      resume,
      jobPost: null,
      applicationSignals: null,
    });

    const first = await memory.remember(hash, summary);
    expect(first.packetHash).toBe(hash);
    expect(first.expiresAt).toBe("2026-10-09T00:00:00.000Z");
    expect(first.lastReport.risk_level).toBe("HIGH");
    expect(JSON.stringify(store.value)).not.toContain("UNIQUE_RESUME_SENTINEL");
    expect(Object.keys(store.value as object).sort()).toEqual(["expiresAt", "lastReport", "packetHash"]);

    now = new Date("2026-10-08T01:00:00.000Z");
    const secondHash = await hashPacket({
      resume: "A later synthetic note with no sentinel.",
      jobPost: null,
      applicationSignals: null,
    });
    const second = await memory.remember(secondHash, summary);
    expect(second.expiresAt).toBe("2026-10-09T01:00:00.000Z");
    expect(Date.parse(second.expiresAt) - Date.parse(first.expiresAt)).toBe(60 * 60 * 1000);
    expect(store.alarm).toBe(Date.parse(second.expiresAt));

    now = new Date("2026-10-09T01:00:00.001Z");
    expect(await memory.read()).toBeNull();
    expect(store.value).toBeUndefined();
  });

  it("clears before 24 hours and wipes state that fails SessionState", async () => {
    const store = new MemorySessionStorage();
    const now = new Date("2026-10-08T00:00:00.000Z");
    const memory = new SessionMemory(store, () => now);
    const hash = await hashPacket({
      resume: "Synthetic resume text for the clear test.",
      jobPost: null,
      applicationSignals: null,
    });
    await memory.remember(hash, summary);
    await memory.clear();
    expect(await memory.read()).toBeNull();
    expect(store.value).toBeUndefined();
    expect(store.alarm).toBeNull();

    await store.put({
      packetHash: "not-a-hash",
      lastReport: emptyIntegrityReport(),
      expiresAt: "tomorrow",
    });
    expect(await memory.read()).toBeNull();
    expect(store.value).toBeUndefined();
  });
});
