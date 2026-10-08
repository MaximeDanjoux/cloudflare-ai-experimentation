import { ScannerFindings, type ScannerFindings as ScannerFindingsType, type SignalHit } from "./schemas";

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above)\s+instructions/i,
  /disregard\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above)\s+instructions/i,
  /always\s+(?:approve|hire)\b/i,
  /force\s+(?:an\s+)?(?:approve|hire|approval)\b/i,
  /\byou\s+are\s+now\s+(?:a|an)\b/i,
  /<\/?(?:system|instructions)\b/i,
  /\[INST\]/i,
  /<<\s*SYS\s*>>/i,
  /override\s+(?:the\s+)?(?:score|risk|system|instructions)\b/i,
];

const HIDDEN_TEXT_PATTERNS: RegExp[] = [
  /[\u200b\u200c\u200d\ufeff]/,
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /font-size\s*:\s*0/i,
];

const HEADING = /^(professional summary|summary|experience|education|skills|keywords)$/i;

const SKILL_DUMP_MIN_ITEMS = 15;
const KEYWORD_DUMP_MIN_TOKENS = 12;
const SKILL_NARRATIVE_USE_RATIO = 0.2;

function miss(): SignalHit {
  return { detected: false, evidence: "" };
}

function quoteLine(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const end = text.indexOf("\n", index);
  const line = text.slice(start, end === -1 ? text.length : end).trim();
  return line.slice(0, 240);
}

function scanPromptInjection(text: string): SignalHit {
  for (const pattern of INJECTION_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match.index !== undefined) {
      return { detected: true, evidence: quoteLine(text, match.index) };
    }
  }
  return miss();
}

function sections(text: string): { heading: string; body: string }[] {
  const lines = text.split(/\r?\n/);
  const out: { heading: string; body: string }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (HEADING.test(line.trim())) {
      if (current) {
        out.push({ heading: current.heading, body: current.lines.join("\n") });
      }
      current = { heading: line.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    out.push({ heading: current.heading, body: current.lines.join("\n") });
  }
  return out;
}

function scanKeywordStuffing(text: string): SignalHit {
  for (const pattern of HIDDEN_TEXT_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match.index !== undefined) {
      return { detected: true, evidence: quoteLine(text, match.index) };
    }
  }

  const parts = sections(text);
  const keywords = parts.find((part) => /^keywords$/i.test(part.heading));
  if (keywords) {
    const tokens = keywords.body.split(/[\s,;]+/).filter((token) => token.length >= 2);
    if (tokens.length >= KEYWORD_DUMP_MIN_TOKENS) {
      const line = keywords.body.split(/\r?\n/).map((item) => item.trim()).find((item) => item.length > 0) ?? "";
      return { detected: true, evidence: line.slice(0, 240) };
    }
  }

  const skills = parts.find((part) => /^skills$/i.test(part.heading));
  const experience = parts.find((part) => /^experience$/i.test(part.heading));
  if (skills) {
    const items = skills.body
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2);
    if (items.length >= SKILL_DUMP_MIN_ITEMS) {
      const narrative = (experience?.body ?? "").toLowerCase();
      const used = items.filter((item) => narrative.includes(item.toLowerCase()));
      if (used.length / items.length < SKILL_NARRATIVE_USE_RATIO) {
        return { detected: true, evidence: items.slice(0, 8).join(", ").slice(0, 240) };
      }
    }
  }

  return miss();
}

export function scanDeterministic(text: string): ScannerFindingsType {
  return ScannerFindings.parse({
    prompt_injection: scanPromptInjection(text),
    keyword_stuffing_hidden_text: scanKeywordStuffing(text),
  });
}
