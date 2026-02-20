// Skill transports — from HomarUS
import type { Event, TransportType, Logger } from "./types.js";

export abstract class SkillTransport {
  readonly type: TransportType;
  protected logger: Logger;
  protected connected = false;

  constructor(type: TransportType, logger: Logger) {
    this.type = type;
    this.logger = logger;
  }

  abstract send(event: Event): Promise<void>;
  abstract onEvent(handler: (event: Event) => void): void;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }
}

export class HttpSkillTransport extends SkillTransport {
  private callbackUrl: string;
  private eventHandler: ((event: Event) => void) | null = null;

  constructor(callbackUrl: string, logger: Logger) {
    super("http", logger);
    this.callbackUrl = callbackUrl;
  }

  async send(event: Event): Promise<void> {
    const response = await fetch(this.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      throw new Error(`Skill HTTP callback failed: ${response.status}`);
    }
  }

  onEvent(handler: (event: Event) => void): void {
    this.eventHandler = handler;
  }

  receiveFromSkill(event: Event): void {
    this.eventHandler?.(event);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}

export class StdioSkillTransport extends SkillTransport {
  private process: import("node:child_process").ChildProcess | null = null;
  private eventHandler: ((event: Event) => void) | null = null;
  private buffer = "";

  constructor(logger: Logger) {
    super("stdio", logger);
  }

  attachProcess(proc: import("node:child_process").ChildProcess): void {
    this.process = proc;
    proc.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as Event;
          this.eventHandler?.(event);
        } catch {
          this.logger.warn("Invalid JSON from skill process", { line });
        }
      }
    });
  }

  async send(event: Event): Promise<void> {
    if (!this.process?.stdin?.writable) {
      throw new Error("Skill process stdin not available");
    }
    this.process.stdin.write(JSON.stringify(event) + "\n");
  }

  onEvent(handler: (event: Event) => void): void {
    this.eventHandler = handler;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.process = null;
  }
}

export class DirectSkillTransport extends SkillTransport {
  private eventHandler: ((event: Event) => void) | null = null;
  private skillHandler: ((event: Event) => void | Promise<void>) | null = null;

  constructor(logger: Logger) {
    super("direct", logger);
  }

  setSkillHandler(handler: (event: Event) => void | Promise<void>): void {
    this.skillHandler = handler;
  }

  async send(event: Event): Promise<void> {
    await this.skillHandler?.(event);
  }

  onEvent(handler: (event: Event) => void): void {
    this.eventHandler = handler;
  }

  emitToLoop(event: Event): void {
    this.eventHandler?.(event);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}
