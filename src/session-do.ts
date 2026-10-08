import { DurableObject } from "cloudflare:workers";

import type { RiskSummary, SessionState } from "./schemas";
import { SessionMemory, type SessionStorage } from "./session";

class DurableSessionStorage implements SessionStorage {
  constructor(private readonly storage: DurableObjectStorage) {}

  async get(): Promise<unknown> {
    return this.storage.get("state");
  }

  async put(value: unknown): Promise<void> {
    await this.storage.put("state", value);
  }

  async delete(): Promise<void> {
    await this.storage.delete("state");
  }

  async setAlarm(when: Date): Promise<void> {
    await this.storage.setAlarm(when);
  }

  async deleteAlarm(): Promise<void> {
    await this.storage.deleteAlarm();
  }
}

export class SessionDurableObject extends DurableObject<Cloudflare.Env> {
  private memory(): SessionMemory {
    return new SessionMemory(new DurableSessionStorage(this.ctx.storage), () => new Date());
  }

  async read(): Promise<SessionState | null> {
    return this.memory().read();
  }

  async remember(packetHash: string, summary: RiskSummary): Promise<SessionState> {
    return this.memory().remember(packetHash, summary);
  }

  async clear(): Promise<void> {
    await this.memory().clear();
  }

  async alarm(): Promise<void> {
    await this.memory().wipe();
  }
}
