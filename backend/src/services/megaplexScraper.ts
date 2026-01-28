import { chromium, Browser, Page } from 'playwright';
import { ShowtimeResult, ShowtimeInfo } from '../models/index.js';

// Theater configurations for the ones we want to scrape
// URLs found: https://megaplex.com/jordancommons, https://megaplex.com/thanksgivingpoint
const MEGAPLEX_THEATERS: Record<string, { slug: string; name: string; id?: number }> = {
  'jordan-commons': {
    slug: 'jordancommons',
    name: 'Megaplex Jordan Commons',
    id: 7,
  },
  'lehi': {
    slug: 'thanksgivingpoint',
    name: 'Megaplex Thanksgiving Point',
    id: 18,
  },
};

interface MegaplexApiShowtime {
  showtime_id: number;
  showtime: string;
  format?: string;
  experience?: string;
  auditorium_type?: string;
}

interface MegaplexApiMovie {
  title: string;
  slug: string;
  showtimes?: MegaplexApiShowtime[];
}

interface MegaplexApiResponse {
  movies?: MegaplexApiMovie[];
  data?: {
    movies?: MegaplexApiMovie[];
  };
}

interface ScrapedShowtime {
  time: string;
  format: string;
}

export class MegaplexScraper {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async getShowtimes(params: {
    movieTitle: string;
    date: Date;
    theaters?: string[];
  }): Promise<ShowtimeResult[]> {
    const { movieTitle, date, theaters = ['jordan-commons', 'lehi'] } = params;
    const results: ShowtimeResult[] = [];

    await this.init();

    for (const theaterId of theaters) {
      const theaterConfig = MEGAPLEX_THEATERS[theaterId];
      if (!theaterConfig) continue;

      try {
        const showtimes = await this.scrapeTheater(theaterConfig.slug, theaterConfig.name, movieTitle, date);
        if (showtimes) {
          results.push(showtimes);
        }
      } catch (error) {
        console.error(`Error scraping ${theaterConfig.name}:`, error);
      }
    }

    return results;
  }

  private async scrapeTheater(
    slug: string,
    theaterName: string,
    movieTitle: string,
    date: Date
  ): Promise<ShowtimeResult | null> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    let apiData: MegaplexApiResponse | null = null;

    try {
      const dateStr = date.toISOString().split('T')[0];
      const url = `https://megaplex.com/${slug}`;
      console.log(`Scraping Megaplex: ${url} for "${movieTitle}" on ${dateStr}`);

      // Intercept network requests to capture API responses
      const apiResponses: MegaplexApiResponse[] = [];
      page.on('response', async (response) => {
        const responseUrl = response.url();
        // Capture any JSON API responses that might contain movie/showtime data
        if (responseUrl.includes('/api/') || responseUrl.includes('megaplex.com') && responseUrl.includes('.json')) {
          try {
            const json = await response.json();
            if (json && (json.movies || json.data || json.showtimes)) {
              console.log(`Captured API response from: ${responseUrl}`);
              apiResponses.push(json);
            }
          } catch {
            // Not JSON, ignore
          }
        }
      });

      // Navigate and wait for full page load
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

      // Wait for Angular to fully render
      await page.waitForTimeout(5000);

      // Try to select the correct date if not today
      await this.selectDate(page, date);
      await page.waitForTimeout(2000);

      // Try to click on the movie to expand it and reveal showtimes
      await this.clickOnMovie(page, movieTitle);
      await page.waitForTimeout(3000);

      // Check intercepted API data
      for (const apiData of apiResponses) {
        const times = this.extractFromApiData(apiData, movieTitle);
        if (times.length > 0) {
          console.log(`Found ${times.length} showtimes from API for "${movieTitle}" at ${theaterName}`);
          return {
            theaterName,
            theaterAddress: '',
            times,
            bookingUrl: `https://megaplex.com/${slug}`,
          };
        }
      }

      // Fallback: scrape the DOM
      const showtimes = await this.scrapeDOM(page, movieTitle);

      if (showtimes.length === 0) {
        // Debug: log the page structure
        console.log(`No showtimes found for "${movieTitle}" at ${theaterName}`);
        console.log(`Page title: ${await page.title()}`);

        // Log what we can find on the page
        const movieCount = await page.evaluate(`document.querySelectorAll('[class*="movie"], [class*="film"], article, .card').length`);
        console.log(`Found ${movieCount} potential movie containers on page`);

        // Log actual movie titles found
        const titles = await page.evaluate(`
          Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, .title, [class*="title"], [class*="name"]'))
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 2 && t.length < 100)
            .slice(0, 15)
        `) as string[];
        console.log(`Titles found on page: ${titles.join(' | ')}`);

        // Try a more aggressive search - look for "Avatar" anywhere in text
        const avatarMentions = await page.evaluate(`
          document.body.innerText.toLowerCase().includes('avatar')
        `);
        console.log(`Page contains 'avatar': ${avatarMentions}`);

        return null;
      }

      const uniqueShowtimes = Array.from(
        new Map(showtimes.map((s) => [`${s.time}-${s.format}`, s])).values()
      );

      const times: ShowtimeInfo[] = uniqueShowtimes.map((s) => ({
        time: s.time,
        format: s.format,
        available: true,
      }));

      this.sortTimes(times);

      console.log(`Found ${times.length} showtimes for "${movieTitle}" at ${theaterName}`);

      return {
        theaterName,
        theaterAddress: '',
        times,
        bookingUrl: `https://megaplex.com/${slug}`,
      };
    } catch (error) {
      console.error(`Error scraping ${theaterName}:`, error);
      return null;
    } finally {
      await page.close();
    }
  }

  private extractFromApiData(data: MegaplexApiResponse, movieTitle: string): ShowtimeInfo[] {
    const times: ShowtimeInfo[] = [];
    const searchLower = movieTitle.toLowerCase();

    const movies = data.movies || data.data?.movies || [];

    for (const movie of movies) {
      const title = movie.title?.toLowerCase() || '';
      if (title.includes(searchLower) || searchLower.includes(title.split(':')[0])) {
        for (const st of movie.showtimes || []) {
          const timeStr = this.parseShowtime(st.showtime);
          if (timeStr) {
            let format = 'Standard';
            const exp = (st.experience || st.auditorium_type || st.format || '').toLowerCase();
            if (exp.includes('imax')) format = 'IMAX';
            else if (exp.includes('3d')) format = '3D';
            else if (exp.includes('dolby')) format = 'Dolby';
            else if (exp.includes('atmos')) format = 'Dolby Atmos';

            times.push({ time: timeStr, format, available: true });
          }
        }
      }
    }

    return times;
  }

  private parseShowtime(showtime: string): string | null {
    // Handle various formats: "2024-01-28T19:30:00", "7:30 PM", etc.
    if (!showtime) return null;

    if (showtime.includes('T')) {
      const date = new Date(showtime);
      const hours = date.getHours();
      const mins = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h = hours % 12 || 12;
      return `${h}:${mins.toString().padStart(2, '0')} ${ampm}`;
    }

    const match = showtime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      return `${match[1]}:${match[2]} ${(match[3] || 'PM').toUpperCase()}`;
    }

    return null;
  }

  private async selectDate(page: Page, date: Date): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      if (targetDate.getTime() === today.getTime()) {
        return; // Today is usually the default
      }

      // Look for date buttons with various patterns
      const dateDay = date.getDate();
      const selectors = [
        `button:has-text("${dateDay}")`,
        `[role="tab"]:has-text("${dateDay}")`,
        `.mat-tab-label:has-text("${dateDay}")`,
        `[class*="date"]:has-text("${dateDay}")`,
      ];

      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            await page.waitForTimeout(2000);
            console.log(`Selected date using selector: ${selector}`);
            return;
          }
        } catch {
          continue;
        }
      }

      console.log('Could not find date selector, using default date');
    } catch (error) {
      console.log('Error selecting date:', error);
    }
  }

  private async clickOnMovie(page: Page, movieTitle: string): Promise<void> {
    const searchTerms = [
      movieTitle.toLowerCase(),
      movieTitle.split(':')[0].toLowerCase(), // "Avatar" from "Avatar: Fire and Ash"
    ];

    try {
      // Look for clickable elements containing the movie title
      for (const term of searchTerms) {
        const selectors = [
          `text="${term}"`,
          `a:has-text("${term}")`,
          `button:has-text("${term}")`,
          `[class*="movie"]:has-text("${term}")`,
          `[class*="card"]:has-text("${term}")`,
        ];

        for (const selector of selectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              await element.click();
              console.log(`Clicked on movie using: ${selector}`);
              return;
            }
          } catch {
            continue;
          }
        }
      }
      console.log('Could not find movie element to click');
    } catch (error) {
      console.log('Error clicking movie:', error);
    }
  }

  private async scrapeDOM(page: Page, movieTitle: string): Promise<ScrapedShowtime[]> {
    const escapedTitle = movieTitle.replace(/"/g, '\\"').toLowerCase();
    // Get first word of movie title for partial matching (e.g., "Avatar")
    const firstWord = escapedTitle.split(/[:\s]/)[0];

    // Use string template to avoid TypeScript DOM issues
    const script = `
      (function(search, firstWord) {
        const results = [];

        // Strategy 1: Find all elements containing the movie title text
        const allText = document.body.innerText;
        const titleIndex = allText.toLowerCase().indexOf(search);
        const firstWordIndex = allText.toLowerCase().indexOf(firstWord);

        // Strategy 2: Look for sections/cards that contain the movie name
        const allElements = document.querySelectorAll('*');
        let movieSection = null;

        for (const el of allElements) {
          const text = el.textContent?.toLowerCase() || '';
          if ((text.includes(search) || text.includes(firstWord)) &&
              el.querySelectorAll('button, a').length > 0) {
            // This element contains the movie name and has clickable elements
            // Check if it's a reasonable container (not the whole page)
            if (el.textContent.length < 5000) {
              movieSection = el;
              break;
            }
          }
        }

        if (movieSection) {
          // Find time patterns in this section
          const sectionText = movieSection.textContent || '';
          const timeMatches = sectionText.match(/(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))/gi) || [];

          for (const timeStr of timeMatches) {
            let format = 'Standard';
            const textLower = sectionText.toLowerCase();

            if (textLower.includes('imax')) format = 'IMAX';
            else if (textLower.includes('3d')) format = '3D';
            else if (textLower.includes('dolby')) format = 'Dolby';

            results.push({
              time: timeStr.toUpperCase(),
              format,
            });
          }
        }

        // Strategy 3: Fallback - find any time patterns near the movie title
        if (results.length === 0 && (titleIndex >= 0 || firstWordIndex >= 0)) {
          const idx = titleIndex >= 0 ? titleIndex : firstWordIndex;
          const nearbyText = allText.substring(Math.max(0, idx - 100), Math.min(allText.length, idx + 2000));
          const timeMatches = nearbyText.match(/(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))/gi) || [];

          for (const timeStr of timeMatches) {
            results.push({
              time: timeStr.toUpperCase(),
              format: 'Standard',
            });
          }
        }

        return results;
      })("${escapedTitle}", "${firstWord}")
    `;

    return await page.evaluate(script) as ScrapedShowtime[];
  }

  private sortTimes(times: ShowtimeInfo[]): void {
    times.sort((a, b) => {
      const parseTime = (t: string) => {
        const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return 0;
        let hours = parseInt(match[1]);
        const mins = parseInt(match[2]);
        const isPM = match[3].toUpperCase() === 'PM';
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
        return hours * 60 + mins;
      };
      return parseTime(a.time) - parseTime(b.time);
    });
  }
}

// Singleton instance
let scraperInstance: MegaplexScraper | null = null;

export function getMegaplexScraper(): MegaplexScraper {
  if (!scraperInstance) {
    scraperInstance = new MegaplexScraper();
  }
  return scraperInstance;
}
