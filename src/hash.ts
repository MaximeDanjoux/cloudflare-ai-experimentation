import { ApplicationPacket, type ApplicationPacket as ApplicationPacketType } from "./schemas";

export function canonicalPacketJson(packet: ApplicationPacketType): string {
  const parsed = ApplicationPacket.parse(packet);
  return JSON.stringify({
    resume: parsed.resume,
    jobPost: parsed.jobPost,
    applicationSignals: parsed.applicationSignals,
  });
}

export async function hashPacket(packet: ApplicationPacketType): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalPacketJson(packet));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
