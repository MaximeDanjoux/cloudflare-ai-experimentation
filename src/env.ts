import type { SessionDurableObject } from "./session-do";

declare global {
  namespace Cloudflare {
    interface Env {
      AI: Ai;
      SCREENING: Workflow;
      SESSION: DurableObjectNamespace<SessionDurableObject>;
    }
  }
}

export {};
