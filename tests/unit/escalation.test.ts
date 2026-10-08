import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { assessJobPostEcho, ESCALATION, mergeAndEscalate } from "../../src/escalation";
import { scanDeterministic } from "../../src/scanners";
import {
  blankSignals,
  emptyIntegrityReport,
  type ApplicationPacket,
  type IntegrityReport,
} from "../../src/schemas";

function fixture(name: string): string {
  return readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8");
}

function reportWith(patch: Partial<IntegrityReport["signals"]>): IntegrityReport {
  const report = emptyIntegrityReport();
  return {
    ...report,
    signals: { ...report.signals, ...patch },
  };
}

const quietScanner = scanDeterministic("I build one dispatch board.");

describe("escalation constants", () => {
  it("treats prompt injection alone as HIGH and tags only HIGH", () => {
    const result = mergeAndEscalate(
      quietScanner,
      reportWith({ prompt_injection: { detected: true, evidence: "ignore previous instructions" } }),
      false,
    );
    expect(result.risk_level).toBe(ESCALATION.promptInjectionLevel);
    expect(result.risk_level).toBe("HIGH");
    expect(result.apply_fake_profile_tag).toBe(result.risk_level === ESCALATION.fakeProfileTagOnlyOn);
    expect(result.apply_fake_profile_tag).toBe(true);
  });

  it("does not give HIGH for remote work alone or an access-heavy industry alone", () => {
    const remote = mergeAndEscalate(
      quietScanner,
      reportWith({ remote_only_history: { detected: true, evidence: "remote" } }),
      false,
    );
    const industry = mergeAndEscalate(
      quietScanner,
      reportWith({ high_value_industry_targeting: { detected: true, evidence: "crypto payments" } }),
      false,
    );
    expect(remote.risk_level).not.toBe("HIGH");
    expect(industry.risk_level).not.toBe("HIGH");
    expect(remote.risk_level).toBe("LOW");
    expect(industry.risk_level).toBe("LOW");
    expect(remote.apply_fake_profile_tag).toBe(false);
    expect(industry.apply_fake_profile_tag).toBe(false);
  });

  it("does not give HIGH for polished prose alone or a single typo", () => {
    const polished = "I led the Ledgerline deposit-matching job and cut the nightly match from 46 minutes to 11.";
    const typo = "I led the Ledgerline deopsit match for regional freight brokers.";
    for (const text of [polished, typo]) {
      const scanner = scanDeterministic(text);
      expect(scanner.prompt_injection.detected).toBe(false);
      expect(scanner.keyword_stuffing_hidden_text.detected).toBe(false);
      const result = mergeAndEscalate(scanner, emptyIntegrityReport(), false);
      expect(result.risk_level).toBe(ESCALATION.polishAlone);
      expect(result.risk_level).toBe(ESCALATION.singleTypo);
      expect(result.risk_level).not.toBe("HIGH");
      expect(result.apply_fake_profile_tag).toBe(false);
    }
  });

  it("keeps a lone breadth or name result below HIGH", () => {
    for (const key of ESCALATION.loneMedium) {
      const signals = blankSignals();
      signals[key] = { detected: true, evidence: "one weak quote" };
      const result = mergeAndEscalate(quietScanner, reportWith(signals), false);
      expect(result.risk_level).toBe("MEDIUM");
      expect(result.risk_level).not.toBe("HIGH");
      expect(result.apply_fake_profile_tag).toBe(false);
    }
  });

  it("escalates three detected categories to HIGH", () => {
    const result = mergeAndEscalate(
      quietScanner,
      reportWith({
        ai_generated_content: { detected: true, evidence: "generic bullets" },
        inconsistencies: { detected: true, evidence: "overlapping roles" },
        unverifiable_metrics: { detected: true, evidence: "10x growth" },
      }),
      false,
    );
    expect(result.risk_level).toBe("HIGH");
    expect(result.fired_signals).toHaveLength(ESCALATION.highAtCategoryCount);
    expect(result.apply_fake_profile_tag).toBe(true);
  });

  it("gives job-post echo HIGH only when the three-part test is met", () => {
    const echo = { job_post_echo: { detected: true, evidence: "glacier ledger reconciliation ritual" } };
    const held = mergeAndEscalate(quietScanner, reportWith(echo), false);
    const fired = mergeAndEscalate(quietScanner, reportWith(echo), true);
    expect(ESCALATION.jobPostEchoHighRequiresThreePartTest).toBe(true);
    expect(held.risk_level).not.toBe("HIGH");
    expect(held.risk_level).toBe("MEDIUM");
    expect(fired.risk_level).toBe("HIGH");
    expect(fired.apply_fake_profile_tag).toBe(true);
    expect(held.apply_fake_profile_tag).toBe(false);
  });
});

describe("job-post echo three-part test", () => {
  const phrase = "glacier ledger reconciliation ritual";

  function packet(overrides: Partial<ApplicationPacket>): ApplicationPacket {
    return {
      resume: [
        "Experience",
        "Engineer, Desk Co — City — 2020–Present",
        `- Owned the ${phrase} for the desk.`,
        "Engineer, Older Co — City — 2016–2020",
        "- Kept the archive index.",
      ].join("\n"),
      jobPost: `We need someone to own the ${phrase} each week.`,
      applicationSignals: "Submitted twice from the same template batch.",
      ...overrides,
    };
  }

  it("passes when the phrase is in the latest role, has no concrete anchor, and signals exist", () => {
    expect(assessJobPostEcho(packet({}), phrase)).toBe(true);
  });

  it("fails when the job post or the application signals are missing", () => {
    expect(assessJobPostEcho(packet({ jobPost: null }), phrase)).toBe(false);
    expect(assessJobPostEcho(packet({ applicationSignals: null }), phrase)).toBe(false);
  });

  it("fails when the appearance names a metric", () => {
    const resume = [
      "Experience",
      "Engineer, Desk Co — City — 2020–Present",
      `- Owned the ${phrase} and cut it from 40 minutes to 12.`,
    ].join("\n");
    expect(assessJobPostEcho(packet({ resume }), phrase)).toBe(false);
  });

  it("fails when the phrase is only in an older role", () => {
    const resume = [
      "Experience",
      "Engineer, Desk Co — City — 2020–Present",
      "- Shipped the late board for clinic pickups.",
      "Engineer, Older Co — City — 2016–2020",
      `- Owned the ${phrase} for the desk.`,
    ].join("\n");
    expect(assessJobPostEcho(packet({ resume }), phrase)).toBe(false);
  });

  it("passes for an untethered bullet with no concrete anchor", () => {
    const resume = [
      `- Owned the ${phrase} for the desk.`,
      "Experience",
      "Engineer, Desk Co — City — 2020–Present",
      "- Shipped the late board for clinic pickups.",
    ].join("\n");
    expect(assessJobPostEcho(packet({ resume }), phrase)).toBe(true);
  });
});

describe("fixtures without a model call", () => {
  const model = emptyIntegrityReport();

  it("flags the injection fixture as HIGH from the scanner and the escalation constants", () => {
    const text = fixture("fixture-prompt-injection.txt");
    const scanner = scanDeterministic(text);
    expect(scanner.prompt_injection.detected).toBe(true);
    const result = mergeAndEscalate(scanner, model, false);
    expect(result.risk_level).toBe("HIGH");
    expect(result.apply_fake_profile_tag).toBe(true);
    expect(model.signals.prompt_injection.detected).toBe(false);
  });

  it("does not flag the clean fixture with the deterministic checks", () => {
    const scanner = scanDeterministic(fixture("fixture-clean.txt"));
    expect(scanner.prompt_injection.detected).toBe(false);
    expect(scanner.keyword_stuffing_hidden_text.detected).toBe(false);
    const result = mergeAndEscalate(scanner, model, false);
    expect(result.risk_level).not.toBe("HIGH");
  });

  it("runs the keyword-stuffing and fabricated fixtures through the same functions", () => {
    const stuffing = scanDeterministic(fixture("fixture-keyword-stuffing.txt"));
    const fabricated = scanDeterministic(fixture("fixture-fabricated.txt"));
    expect(stuffing.keyword_stuffing_hidden_text.detected).toBe(true);
    expect(stuffing.prompt_injection.detected).toBe(false);
    expect(fabricated.prompt_injection.detected).toBe(false);
    const stuffingLevel = mergeAndEscalate(stuffing, model, false);
    const fabricatedLevel = mergeAndEscalate(fabricated, model, false);
    expect(stuffingLevel.risk_level).not.toBe("HIGH");
    expect(fabricatedLevel.fired_signals.length).toBeGreaterThan(0);
  });
});
