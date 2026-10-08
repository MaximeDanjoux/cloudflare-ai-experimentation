import { FailClosed } from "./errors";

export const LLAMA_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

type ChatMessage = { role: "system" | "user"; content: string };

function readModelText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (result && typeof result === "object") {
    if ("response" in result && typeof result.response === "string") {
      return result.response;
    }
    if ("result" in result && result.result && typeof result.result === "object" && "response" in result.result) {
      const nested = result.result.response;
      if (typeof nested === "string") {
        return nested;
      }
    }
  }
  throw new FailClosed("invalid_model_json");
}

export async function callLlama(ai: Ai, model: string, system: string, user: string): Promise<string> {
  if (model !== LLAMA_MODEL) {
    throw new FailClosed("invalid_model");
  }
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const result = await ai.run(LLAMA_MODEL, { messages });
  return readModelText(result);
}
