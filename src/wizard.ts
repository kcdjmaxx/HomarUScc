// CRC: crc-Wizard.md | Seq: seq-first-run.md
// Interactive first-run wizard — collects setup answers and delegates to Scaffolder.
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { exec } from "node:child_process";
import { Scaffolder } from "./scaffolder.js";
import { ClaudeCodeRegistrar } from "./claude-code-registrar.js";

export interface WizardAnswers {
  agentName: string | null;
  channels: Set<string>;
  identityPath: "alignment" | "template";
  soulContent: string | null;
  userName: string;
  userContext: string;
  telegramToken: string | null;
}

export class Wizard {
  private rl: ReadlineInterface | null = null;

  // Seq: seq-first-run.md
  async run(): Promise<void> {
    this.rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
      this.printBanner();

      const agentName = await this.promptAgentName();
      const channels = await this.promptChannels();
      const { identityPath, soulContent } = await this.promptIdentity();
      const { userName, userContext } = await this.promptUserContext();
      const telegramToken = channels.has("telegram")
        ? await this.promptTokens()
        : null;

      const answers: WizardAnswers = {
        agentName,
        channels,
        identityPath,
        soulContent,
        userName,
        userContext,
        telegramToken,
      };

      // Seq: seq-first-run.md
      const scaffolder = new Scaffolder();
      const createdFiles = await scaffolder.scaffold(answers);

      // Seq: seq-first-run.md
      const registrar = new ClaudeCodeRegistrar();
      await registrar.promptRegister(this.rl);

      this.printSummary(createdFiles);
    } finally {
      this.rl.close();
      this.rl = null;
    }
  }

  private printBanner(): void {
    console.log("");
    console.log("  ╔══════════════════════════════════════╗");
    console.log("  ║     HomarUScc — Removing the Caul    ║");
    console.log("  ╚══════════════════════════════════════╝");
    console.log("");
    console.log("  First-run setup. This will create ~/.homaruscc/");
    console.log("");
  }

  // CRC: crc-Wizard.md
  private async promptAgentName(): Promise<string | null> {
    const name = await this.ask(
      "What should your agent be called? (press Enter to skip — it will name itself): ",
    );
    return name.trim() || null;
  }

  // CRC: crc-Wizard.md
  private async promptChannels(): Promise<Set<string>> {
    const channels = new Set<string>(["dashboard"]);

    console.log("\n  Channels:");
    console.log("    Dashboard — always enabled (localhost:3120)");

    const useTelegram = await this.ask(
      "  Enable Telegram? (requires bot token from @BotFather) [y/N]: ",
    );
    if (useTelegram.trim().toLowerCase() === "y") {
      channels.add("telegram");
    }

    return channels;
  }

  // CRC: crc-Wizard.md
  private async promptIdentity(): Promise<{
    identityPath: "alignment" | "template";
    soulContent: string | null;
  }> {
    console.log("\n  Identity Setup:");
    console.log("    1) Alignment Generator — create a custom soul in your browser");
    console.log("    2) Template — use default identity files");

    const choice = await this.ask("  Choose [1/2]: ");

    if (choice.trim() === "1") {
      const url = "https://kcdjmaxx.github.io/Alignment-generator/";
      console.log(`\n  Opening ${url} ...`);
      this.openBrowser(url);
      console.log("  Complete the generator, then paste the output below.");
      console.log("  (Paste the full text, then press Enter twice on an empty line to finish)");

      const content = await this.askMultiline("  > ");
      return { identityPath: "alignment", soulContent: content };
    }

    return { identityPath: "template", soulContent: null };
  }

  // CRC: crc-Wizard.md
  private async promptUserContext(): Promise<{ userName: string; userContext: string }> {
    console.log("");
    const userName = await this.ask("  What's your name? ");
    const userContext = await this.ask(
      "  What should the agent know about you? (one line is fine): ",
    );
    return { userName: userName.trim(), userContext: userContext.trim() };
  }

  // CRC: crc-Wizard.md
  private async promptTokens(): Promise<string> {
    console.log("");
    const token = await this.ask("  Telegram bot token (from @BotFather): ");
    return token.trim();
  }

  // CRC: crc-Wizard.md
  private openBrowser(url: string): void {
    const cmd = process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${cmd} ${url}`, (err) => {
      if (err) {
        console.log(`  Could not open browser automatically. Visit: ${url}`);
      }
    });
  }

  // CRC: crc-Wizard.md
  private printSummary(files: string[]): void {
    console.log("\n  Setup complete! Created:");
    for (const f of files) {
      console.log(`    ${f}`);
    }
    console.log("\n  Next steps:");
    console.log("    1. Run `npx homaruscc` again to start the MCP server");
    console.log("    2. Open Claude Code — HomarUScc tools will be available");
    console.log("    3. Say hello to your agent!\n");
  }

  // --- readline helpers ---

  private ask(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl!.question(prompt, (answer) => resolve(answer));
    });
  }

  private async askMultiline(prompt: string): Promise<string> {
    const lines: string[] = [];
    let emptyCount = 0;

    while (true) {
      const line = await this.ask(emptyCount === 0 ? prompt : "  > ");
      if (line.trim() === "") {
        emptyCount++;
        if (emptyCount >= 2) break;
      } else {
        // If we had one empty line but then got content, it was just a paragraph break
        if (emptyCount > 0) {
          lines.push("");
          emptyCount = 0;
        }
        lines.push(line);
      }
    }

    return lines.join("\n");
  }
}
