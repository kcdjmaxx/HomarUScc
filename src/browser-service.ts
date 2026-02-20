// Browser service — Playwright-based browser automation for HomarUScc
// Follows TimerService lifecycle pattern: lazy launch, graceful shutdown
import type { Browser, BrowserContext, Page } from "playwright";
import type { BrowserConfig, Logger } from "./types.js";

export class BrowserService {
  private browser: Browser | null = null;
  private persistentContext: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;
  private logger: Logger;

  constructor(logger: Logger, config: BrowserConfig) {
    this.logger = logger;
    this.config = config;
  }

  private async ensureBrowser(): Promise<Page> {
    if (this.page) return this.page;

    const { chromium } = await import("playwright");

    const headless = this.config.headless ?? true;
    const viewport = this.config.viewport ?? { width: 1280, height: 720 };

    if (this.config.userDataDir) {
      // Persistent context — reuses cookies, localStorage, sessions across launches
      this.logger.info("Launching persistent browser", {
        headless,
        userDataDir: this.config.userDataDir,
      });
      const context = await chromium.launchPersistentContext(
        this.config.userDataDir,
        {
          headless,
          viewport,
          ...(this.config.executablePath && {
            executablePath: this.config.executablePath,
          }),
          ...(this.config.proxy && { proxy: { server: this.config.proxy } }),
        },
      );
      // launchPersistentContext returns a BrowserContext, not a Browser
      this.persistentContext = context;
      this.page = context.pages()[0] ?? (await context.newPage());
    } else {
      // Ephemeral context — clean session each time
      const launchOptions: Record<string, unknown> = { headless };
      if (this.config.executablePath) {
        launchOptions.executablePath = this.config.executablePath;
      }
      if (this.config.proxy) {
        launchOptions.proxy = { server: this.config.proxy };
      }

      this.logger.info("Launching browser", { headless });
      this.browser = await chromium.launch(launchOptions);

      const context = await this.browser.newContext({ viewport });
      this.page = await context.newPage();
    }

    this.page.setDefaultTimeout(this.config.timeout ?? 30000);
    this.logger.info("Browser ready");
    return this.page;
  }

  async navigate(url: string): Promise<string> {
    const page = await this.ensureBrowser();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    return `Navigated to: ${page.url()}\nTitle: ${title}`;
  }

  async snapshot(): Promise<string> {
    const page = await this.ensureBrowser();
    const snap = await page.locator("body").ariaSnapshot();
    return snap || "Empty accessibility snapshot";
  }

  async screenshot(): Promise<string> {
    const page = await this.ensureBrowser();
    const buffer = await page.screenshot({ type: "png" });
    return buffer.toString("base64");
  }

  async click(selector: string): Promise<string> {
    const page = await this.ensureBrowser();
    await page.click(selector);
    return `Clicked: ${selector}`;
  }

  async type(selector: string, text: string): Promise<string> {
    const page = await this.ensureBrowser();
    await page.fill(selector, text);
    return `Typed into: ${selector}`;
  }

  async evaluate(script: string): Promise<string> {
    const page = await this.ensureBrowser();
    const result = await page.evaluate(script);
    return typeof result === "string" ? result : JSON.stringify(result, null, 2);
  }

  async getContent(): Promise<string> {
    const page = await this.ensureBrowser();
    return await page.evaluate(() => document.body.innerText);
  }

  async stop(): Promise<void> {
    this.logger.info("Closing browser");
    if (this.persistentContext) {
      await this.persistentContext.close();
      this.persistentContext = null;
    } else if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.page = null;
  }
}
