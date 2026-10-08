import { SessionState, type RiskSummary, type SessionState as SessionStateType } from "./schemas";

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionStorage {
  get(): Promise<unknown>;
  put(value: unknown): Promise<void>;
  delete(): Promise<void>;
  setAlarm(when: Date): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export class MemorySessionStorage implements SessionStorage {
  value: unknown = undefined;
  alarm: number | null = null;

  async get(): Promise<unknown> {
    return this.value;
  }

  async put(value: unknown): Promise<void> {
    this.value = value;
  }

  async delete(): Promise<void> {
    this.value = undefined;
  }

  async setAlarm(when: Date): Promise<void> {
    this.alarm = when.getTime();
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

export class SessionMemory {
  constructor(
    private readonly storage: SessionStorage,
    private readonly now: () => Date,
  ) {}

  async read(): Promise<SessionStateType | null> {
    const raw = await this.storage.get();
    if (raw === undefined || raw === null) {
      return null;
    }
    const parsed = SessionState.safeParse(raw);
    if (!parsed.success) {
      await this.wipe();
      return null;
    }
    if (Date.parse(parsed.data.expiresAt) <= this.now().getTime()) {
      await this.wipe();
      return null;
    }
    return parsed.data;
  }

  async remember(packetHash: string, summary: RiskSummary): Promise<SessionStateType> {
    const expiresAt = new Date(this.now().getTime() + SESSION_TTL_MS).toISOString();
    const state = SessionState.parse({
      packetHash,
      lastReport: summary,
      expiresAt,
    });
    await this.storage.put(state);
    await this.storage.setAlarm(new Date(expiresAt));
    return state;
  }

  async clear(): Promise<void> {
    await this.wipe();
  }

  async wipe(): Promise<void> {
    await this.storage.delete();
    try {
      await this.storage.deleteAlarm();
    } catch {
      // The alarm handler may already be consuming the only alarm.
    }
  }
}
