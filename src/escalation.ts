import {
  SIGNAL_KEYS,
  type ApplicationPacket,
  type IntegrityReport,
  type RiskLevel,
  type ScannerFindings,
  type SignalKey,
} from "./schemas";

export const ESCALATION = {
  promptInjectionLevel: "HIGH",
  highAtCategoryCount: 3,
  mediumAtCategoryCount: 1,
  noCategoryLevel: "LOW",
  jobPostEchoHighRequiresThreePartTest: true,
  gatedUnlessAnotherCategory: [
    "persona_red_flags",
    "high_value_industry_targeting",
    "remote_only_history",
  ],
  loneMedium: ["extreme_skill_breadth", "suspicious_name_patterns"],
  fakeProfileTagOnlyOn: "HIGH",
  polishAlone: "LOW",
  singleTypo: "LOW",
} as const;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you", "our",
  "are", "was", "were", "will", "can", "who", "has", "have", "had", "not", "but",
  "its", "their", "they", "them", "than", "then", "each", "week", "role", "work",
  "someone", "need", "someone", "own",
]);

const CONCRETE_ANCHOR = /\d|\b(api|postgres|postgresql|mysql|kubernetes|docker|react|node|python|system|service|platform|percent|users|revenue|minutes|minute)\b/i;

export type EscalationResult = {
  signals: IntegrityReport["signals"];
  risk_level: RiskLevel;
  confidence_score: number;
  apply_fake_profile_tag: boolean;
  fired_signals: SignalKey[];
};

function cloneSignals(signals: IntegrityReport["signals"]): IntegrityReport["signals"] {
  const next = {} as IntegrityReport["signals"];
  for (const key of SIGNAL_KEYS) {
    next[key] = { detected: signals[key].detected, evidence: signals[key].evidence };
  }
  return next;
}

function applyGates(signals: IntegrityReport["signals"]): IntegrityReport["signals"] {
  const gated = new Set<string>(ESCALATION.gatedUnlessAnotherCategory);
  const detected = SIGNAL_KEYS.filter((key) => signals[key].detected);
  if (detected.length === 1 && gated.has(detected[0])) {
    signals[detected[0]] = { detected: false, evidence: "" };
  }
  return signals;
}

export function applyEscalation(
  signals: IntegrityReport["signals"],
  confidenceScore: number,
  jobPostEchoHigh: boolean,
): EscalationResult {
  const next = applyGates(cloneSignals(signals));
  const fired = SIGNAL_KEYS.filter((key) => next[key].detected);
  let risk_level: RiskLevel;
  if (next.prompt_injection.detected) {
    risk_level = ESCALATION.promptInjectionLevel;
  } else if (
    ESCALATION.jobPostEchoHighRequiresThreePartTest &&
    next.job_post_echo.detected &&
    jobPostEchoHigh
  ) {
    risk_level = "HIGH";
  } else if (fired.length >= ESCALATION.highAtCategoryCount) {
    risk_level = "HIGH";
  } else if (fired.length >= ESCALATION.mediumAtCategoryCount) {
    risk_level = "MEDIUM";
  } else {
    risk_level = ESCALATION.noCategoryLevel;
  }
  return {
    signals: next,
    risk_level,
    confidence_score: confidenceScore,
    apply_fake_profile_tag: risk_level === ESCALATION.fakeProfileTagOnlyOn,
    fired_signals: fired,
  };
}

export function mergeAndEscalate(
  scanner: ScannerFindings,
  report: IntegrityReport,
  jobPostEchoHigh: boolean,
): EscalationResult {
  const signals = cloneSignals(report.signals);
  if (scanner.prompt_injection.detected) {
    signals.prompt_injection = {
      detected: true,
      evidence: scanner.prompt_injection.evidence,
    };
  }
  if (scanner.keyword_stuffing_hidden_text.detected) {
    signals.keyword_stuffing_hidden_text = {
      detected: true,
      evidence: scanner.keyword_stuffing_hidden_text.evidence,
    };
  }
  return applyEscalation(signals, report.confidence_score, jobPostEchoHigh);
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function distinctivePhrases(jobPost: string): string[] {
  const tokens = words(jobPost);
  const phrases: string[] = [];
  for (let index = 0; index <= tokens.length - 4; index += 1) {
    const slice = tokens.slice(index, index + 4);
    const content = slice.filter((word) => !STOP_WORDS.has(word));
    if (content.length < 3) {
      continue;
    }
    phrases.push(slice.join(" "));
  }
  return phrases;
}

function roleEndYear(header: string): number {
  if (/\b(?:present|current)\b/i.test(header)) {
    return 9999;
  }
  const years = [...header.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  return years.length === 0 ? 0 : Math.max(...years);
}

function latestRoleAndUntethered(resume: string): string {
  const lines = resume.split(/\r?\n/);
  let inExperience = false;
  let current: string[] | null = null;
  let currentEnd = -1;
  let best: string[] = [];
  let bestEnd = -1;
  const untethered: string[] = [];

  const closeRole = () => {
    if (current && currentEnd > bestEnd) {
      best = current;
      bestEnd = currentEnd;
    }
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^experience$/i.test(trimmed)) {
      inExperience = true;
      continue;
    }
    if (inExperience && /^(education|skills|keywords|summary|professional summary)$/i.test(trimmed)) {
      inExperience = false;
      closeRole();
      continue;
    }
    const roleHeader = /\b(?:19|20)\d{2}\b/.test(trimmed) && !trimmed.startsWith("-") && !trimmed.startsWith("•");
    if (inExperience && roleHeader) {
      closeRole();
      current = [line];
      currentEnd = roleEndYear(trimmed);
      continue;
    }
    if (inExperience && current) {
      current.push(line);
      continue;
    }
    if (!inExperience && /^[-•]/.test(trimmed)) {
      untethered.push(line);
    }
  }
  closeRole();
  return [...best, ...untethered].join("\n");
}

export function assessJobPostEcho(packet: ApplicationPacket, evidence: string): boolean {
  if (!packet.jobPost || !packet.applicationSignals) {
    return false;
  }
  const place = latestRoleAndUntethered(packet.resume);
  const phrases = distinctivePhrases(packet.jobPost).filter((phrase) => place.toLowerCase().includes(phrase));
  const quotes = phrases.length > 0 ? phrases : evidence.trim() ? [evidence.trim().toLowerCase()] : [];
  if (quotes.length === 0) {
    return false;
  }
  const echoed = quotes.filter((quote) => place.toLowerCase().includes(quote.toLowerCase()));
  if (echoed.length === 0) {
    return false;
  }
  const lines = place.split(/\r?\n/);
  for (const quote of echoed) {
    const line = lines.find((item) => item.toLowerCase().includes(quote.toLowerCase()));
    if (!line || CONCRETE_ANCHOR.test(line)) {
      return false;
    }
  }
  return true;
}

export function clearEchoWhenJobPostMissing(
  packet: ApplicationPacket,
  report: IntegrityReport,
): IntegrityReport {
  if (packet.jobPost) {
    return report;
  }
  return {
    ...report,
    signals: {
      ...report.signals,
      job_post_echo: { detected: false, evidence: "" },
    },
  };
}
