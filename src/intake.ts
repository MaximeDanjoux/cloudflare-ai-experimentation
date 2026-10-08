import {
  ApplicationPacket,
  ChatMessageRequest,
  type ApplicationPacket as ApplicationPacketType,
  type ChatMessageRequest as ChatMessageRequestType,
} from "./schemas";

export function intake(request: ChatMessageRequestType): ApplicationPacketType {
  const parsed = ChatMessageRequest.parse(request);
  return ApplicationPacket.parse({
    resume: parsed.text,
    jobPost: parsed.jobPost ?? null,
    applicationSignals: parsed.applicationSignals ?? null,
  });
}
