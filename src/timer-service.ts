// CRC: crc-TimerService.md | Seq: seq-timer-fire.md
// Timer service — from HomarUS
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { v4 as uuid } from "uuid";
import { Cron } from "croner";
import type { Event, Logger } from "./types.js";

export interface TimerConfig {
  id?: string;
  name: string;
  type: "cron" | "interval" | "once";
  schedule: string;
  prompt: string;
  timezone?: string;
}

interface TimerEntry {
  config: TimerConfig;
  job?: Cron;
  timeout?: ReturnType<typeof setTimeout>;
}

export class TimerService {
  private timers = new Map<string, TimerEntry>();
  private storePath: string;
  private logger: Logger;
  private emitFn: ((event: Event) => void) | null = null;

  constructor(logger: Logger, storePath: string) {
    this.logger = logger;
    this.storePath = storePath;
  }

  setEmitter(fn: (event: Event) => void): void {
    this.emitFn = fn;
  }

  loadTimers(): void {
    if (!existsSync(this.storePath)) return;
    try {
      const data = JSON.parse(readFileSync(this.storePath, "utf-8")) as TimerConfig[];
      // Dedup by name on load — last entry wins
      const byName = new Map<string, TimerConfig>();
      for (const config of data) {
        config.id = config.id ?? uuid();
        byName.set(config.name, config);
      }
      for (const config of byName.values()) {
        this.timers.set(config.id!, { config });
      }
      // Save deduped version back
      if (byName.size < data.length) {
        this.saveTimers();
        this.logger.info("Deduped timers on load", { before: data.length, after: byName.size });
      }
      this.logger.info("Loaded timers", { count: this.timers.size });
    } catch (err) {
      this.logger.error("Failed to load timers", { error: String(err) });
    }
  }

  saveTimers(): void {
    const data = [...this.timers.values()].map((e) => e.config);
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.storePath, JSON.stringify(data, null, 2));
  }

  add(config: TimerConfig): string {
    // Dedup: if a timer with the same name exists, remove it first
    for (const [existingId, entry] of this.timers) {
      if (entry.config.name === config.name) {
        this.stopTimer(entry);
        this.timers.delete(existingId);
        this.logger.info("Replaced existing timer", { id: existingId, name: config.name });
      }
    }
    const id = config.id ?? uuid();
    config.id = id;
    this.timers.set(id, { config });
    this.startTimer(id);
    this.saveTimers();
    this.logger.info("Timer added", { id, name: config.name, type: config.type });
    return id;
  }

  remove(timerIdOrName: string): void {
    // Try by ID first, then by name
    let id = timerIdOrName;
    if (!this.timers.has(id)) {
      for (const [existingId, entry] of this.timers) {
        if (entry.config.name === timerIdOrName) {
          id = existingId;
          break;
        }
      }
    }
    const entry = this.timers.get(id);
    if (!entry) return;
    this.stopTimer(entry);
    this.timers.delete(id);
    this.saveTimers();
    this.logger.info("Timer removed", { id, name: entry.config.name });
  }

  get(timerId: string): TimerConfig | undefined {
    return this.timers.get(timerId)?.config;
  }

  getAll(): TimerConfig[] {
    return [...this.timers.values()].map((e) => e.config);
  }

  start(): void {
    for (const [id] of this.timers) {
      this.startTimer(id);
    }
    this.logger.info("Timer service started", { count: this.timers.size });
  }

  stop(): void {
    for (const entry of this.timers.values()) {
      this.stopTimer(entry);
    }
    this.saveTimers();
    this.logger.info("Timer service stopped");
  }

  private onFire(timerId: string): void {
    const entry = this.timers.get(timerId);
    if (!entry || !this.emitFn) return;

    const event: Event = {
      id: uuid(),
      type: "timer_fired",
      source: `timer:${timerId}`,
      timestamp: Date.now(),
      payload: {
        timerId,
        name: entry.config.name,
        prompt: entry.config.prompt,
      },
    };

    this.logger.info("Timer fired", { id: timerId, name: entry.config.name });
    this.emitFn(event);

    if (entry.config.type === "once") {
      this.timers.delete(timerId);
      this.saveTimers();
    }
  }

  private startTimer(id: string): void {
    const entry = this.timers.get(id);
    if (!entry) return;
    this.stopTimer(entry);

    const { config } = entry;
    switch (config.type) {
      case "cron":
        entry.job = new Cron(config.schedule, { timezone: config.timezone }, () => this.onFire(id));
        break;
      case "interval":
        entry.timeout = setInterval(() => this.onFire(id), parseInt(config.schedule, 10));
        break;
      case "once": {
        const fireAt = new Date(config.schedule).getTime();
        const delay = Math.max(0, fireAt - Date.now());
        entry.timeout = setTimeout(() => this.onFire(id), delay);
        break;
      }
    }
  }

  private stopTimer(entry: TimerEntry): void {
    if (entry.job) {
      entry.job.stop();
      entry.job = undefined;
    }
    if (entry.timeout) {
      clearTimeout(entry.timeout);
      clearInterval(entry.timeout);
      entry.timeout = undefined;
    }
  }
}
