import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { ShowtimeResult, ShowtimeInfo } from '../models/index.js';

export interface ScraperParams {
  movieTitle: string;
  date: Date;
  theaterName?: string;
  location?: { zip?: string; city?: string };
}

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected rateLimitMs: number;
  protected maxConcurrent: number;
  protected activeRequests: number = 0;
  protected lastRequestTime: number = 0;

  constructor() {
    this.rateLimitMs = parseInt(process.env.SCRAPE_RATE_LIMIT_MS || '2000');
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SCRAPES || '2');
  }

  protected async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

      this.browser = await chromium.launch({
        headless: true,
        executablePath: executablePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  protected async getPage(): Promise<{ page: Page; context: BrowserContext }> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    return { page, context };
  }

  protected async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitMs) {
      await new Promise(resolve =>
        setTimeout(resolve, this.rateLimitMs - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  protected normalizeMovieTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  protected titleMatches(title1: string, title2: string): boolean {
    const normalized1 = this.normalizeMovieTitle(title1);
    const normalized2 = this.normalizeMovieTitle(title2);

    // Exact match
    if (normalized1 === normalized2) return true;

    // One contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;

    // Check word overlap
    const words1 = normalized1.split(' ');
    const words2 = normalized2.split(' ');
    const commonWords = words1.filter(w => words2.includes(w) && w.length > 2);

    return commonWords.length >= Math.min(words1.length, words2.length) * 0.7;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  abstract getShowtimes(params: ScraperParams): Promise<ShowtimeResult[]>;
}
