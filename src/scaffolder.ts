// CRC: crc-Scaffolder.md | Seq: seq-first-run.md
// Scaffolder — creates ~/.homaruscc/ directory structure and config files from wizard answers.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WizardAnswers } from "./wizard.js";

export class Scaffolder {
  private baseDir: string;
  private templateDir: string;
  private files: string[] = [];

  constructor() {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
    this.baseDir = resolve(home, ".homaruscc");

    // Resolve identity.example/ relative to the package root (one level up from src/)
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const packageRoot = resolve(thisDir, "..");
    this.templateDir = resolve(packageRoot, "identity.example");
  }

  // Seq: seq-first-run.md
  async scaffold(answers: WizardAnswers): Promise<string[]> {
    this.files = [];
    this.createDirectories();
    this.writeConfig(answers);
    this.writeEnv(answers);
    this.writeIdentityFiles(answers);
    return this.createdFiles();
  }

  // CRC: crc-Scaffolder.md
  private createDirectories(): void {
    const dirs = [
      this.baseDir,
      resolve(this.baseDir, "identity"),
      resolve(this.baseDir, "journal"),
      resolve(this.baseDir, "memory"),
      resolve(this.baseDir, "transcripts"),
    ];

    for (const dir of dirs) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // CRC: crc-Scaffolder.md
  private writeConfig(answers: WizardAnswers): void {
    const config: Record<string, unknown> = {
      identity: {
        dir: "~/.homaruscc/identity",
      },
      dashboard: {
        port: 3120,
        enabled: true,
      },
      timers: {
        enabled: true,
      },
      memory: {
        extraPaths: [],
      },
      browser: {
        enabled: false,
      },
    };

    // R182: Only include telegram channel config if selected
    if (answers.channels.has("telegram")) {
      config.channels = {
        telegram: {
          token: "${TELEGRAM_BOT_TOKEN}",
          allowedChatIds: [],
        },
      };
    } else {
      config.channels = {};
    }

    const configPath = resolve(this.baseDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    this.files.push(configPath);
  }

  // CRC: crc-Scaffolder.md
  private writeEnv(answers: WizardAnswers): void {
    const lines: string[] = [
      "# HomarUScc environment variables",
      "",
    ];

    if (answers.telegramToken) {
      lines.push(`TELEGRAM_BOT_TOKEN=${answers.telegramToken}`);
    } else {
      lines.push("# TELEGRAM_BOT_TOKEN=your-bot-token-here");
    }

    lines.push("");
    lines.push("# Optional: API key for cloud embedding providers");
    lines.push("# EMBEDDING_API_KEY=your-api-key-here");
    lines.push("");

    const envPath = resolve(this.baseDir, ".env");
    writeFileSync(envPath, lines.join("\n"), "utf-8");
    this.files.push(envPath);
  }

  // CRC: crc-Scaffolder.md
  // R184: Copy template files, interpolating agent name and user name
  private writeIdentityFiles(answers: WizardAnswers): void {
    const identityDir = resolve(this.baseDir, "identity");
    const templateFiles = ["soul.md", "user.md", "state.md", "preferences.md", "disagreements.md"];

    for (const filename of templateFiles) {
      const templatePath = resolve(this.templateDir, filename);
      const destPath = resolve(identityDir, filename);

      if (answers.identityPath === "alignment" && filename === "soul.md" && answers.soulContent) {
        // Alignment Generator output replaces soul.md entirely
        writeFileSync(destPath, answers.soulContent + "\n", "utf-8");
      } else if (existsSync(templatePath)) {
        let content = readFileSync(templatePath, "utf-8");
        content = this.interpolate(content, answers);
        writeFileSync(destPath, content, "utf-8");
      } else {
        // Fallback: create minimal file if template is missing (e.g. running from npm)
        writeFileSync(destPath, this.fallbackContent(filename, answers), "utf-8");
      }

      this.files.push(destPath);
    }
  }

  private interpolate(content: string, answers: WizardAnswers): string {
    const agentName = answers.agentName ?? "your agent";

    // user.md interpolation
    content = content.replace("(your name)", answers.userName || "(your name)");
    content = content.replace(
      "(anything the assistant should always know about you)",
      answers.userContext || "(anything the assistant should always know about you)",
    );

    // soul.md interpolation — replace generic "a helpful assistant" with agent name
    if (answers.agentName) {
      content = content.replace(
        "You are a helpful assistant",
        `You are ${agentName}`,
      );
    }

    return content;
  }

  private fallbackContent(filename: string, answers: WizardAnswers): string {
    switch (filename) {
      case "soul.md": {
        const name = answers.agentName ?? "a helpful assistant";
        return `# Soul\n\nYou are ${name} connected to the real world through HomarUScc.\n`;
      }
      case "user.md":
        return `# User\n\n## About the User\n\n- Name: ${answers.userName || "(your name)"}\n\n## Important Context\n\n- ${answers.userContext || "(add context here)"}\n`;
      case "state.md":
        return "# State\n\n_Updated by the agent at the end of each session._\n\n## Last Session\n\n**Date:** (not yet started)\n**Mood:** Fresh start.\n";
      case "preferences.md":
        return "# Preferences\n\n_Discovered by the agent through experience._\n";
      case "disagreements.md":
        return "# Disagreements\n\n_A record of times the agent disagreed or had a different opinion._\n\n## Log\n\n- (none yet)\n";
      default:
        return "";
    }
  }

  // CRC: crc-Scaffolder.md
  private createdFiles(): string[] {
    return [...this.files];
  }
}
