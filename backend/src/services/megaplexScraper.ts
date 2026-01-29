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
      // Try including date in URL - Megaplex may support date parameter
      const url = `https://megaplex.com/${slug}?date=${dateStr}`;
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

      // Navigate with domcontentloaded (faster, avoids timeout)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Wait for Angular to render content
      await page.waitForTimeout(6000);

      // Try to select the correct date if not today
      await this.selectDate(page, date);
      await page.waitForTimeout(2000);

      // Find and click on the movie's "Preview Showtimes" button or the movie card
      const clicked = await this.clickOnMovieShowtimes(page, movieTitle);
      if (clicked) {
        // Wait for showtimes to load after clicking
        await page.waitForTimeout(4000);
      } else {
        // If we couldn't find the movie, don't return false data
        console.log(`Movie "${movieTitle}" not found at ${theaterName}, skipping`);
        return null;
      }

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

      // Fallback: scrape the DOM (only if we clicked on the movie)
      const showtimes = await this.scrapeDOM(page, movieTitle);

      if (showtimes.length === 0) {
        // Debug: log the page structure
        console.log(`No showtimes found for "${movieTitle}" at ${theaterName}`);
        console.log(`Page title: ${await page.title()}`);
        console.log(`Current URL: ${page.url()}`);

        // Look for time patterns anywhere on the page
        const timePatterns = await page.evaluate(`
          (function() {
            const text = document.body.innerText;
            const matches = text.match(/\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm)/gi) || [];
            return matches.slice(0, 20);
          })()
        `) as string[];
        console.log(`Time patterns found on page: ${timePatterns.join(', ') || 'NONE'}`);

        // Find elements containing times and log their details
        const timeElements = await page.evaluate(`
          (function() {
            const results = [];
            const allEls = document.querySelectorAll('*');
            for (const el of allEls) {
              const text = el.textContent?.trim() || '';
              if (text.match(/\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm)/i) && text.length < 100) {
                results.push({
                  tag: el.tagName,
                  class: el.className?.substring?.(0, 50) || '',
                  text: text.substring(0, 80)
                });
              }
            }
            return results.slice(0, 10);
          })()
        `);
        console.log(`Elements with times: ${JSON.stringify(timeElements)}`);

        // Look for all buttons with their text
        const buttons = await page.evaluate(`
          (function() {
            return Array.from(document.querySelectorAll('button, a.btn, [role="button"]'))
              .map(el => el.textContent?.trim().substring(0, 50))
              .filter(t => t && t.length > 0)
              .slice(0, 20);
          })()
        `) as string[];
        console.log(`Buttons on page: ${buttons.join(' | ')}`);

        // Check if showtimes section exists
        const showtimeSection = await page.evaluate(`
          (function() {
            const text = document.body.innerText.toLowerCase();
            const idx = text.indexOf('showtime');
            if (idx >= 0) {
              return text.substring(idx, Math.min(idx + 500, text.length));
            }
            return 'No showtime section found';
          })()
        `);
        console.log(`Showtime section: ${showtimeSection}`);

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
        console.log('Target date is today, no need to change date selector');
        return; // Today is usually the default
      }

      const dateDay = date.getDate();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[date.getDay()];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[date.getMonth()];

      console.log(`Looking for date selector: day=${dateDay}, dayName=${dayName}, month=${monthName}`);

      // Debug: Log what navigation/date-related elements exist on the page
      const dateElements = await page.evaluate(`
        (function() {
          const results = [];
          // Look for navigation elements, tabs, or elements near the top of the page
          const candidates = document.querySelectorAll('nav *, header *, [class*="tab"], [class*="filter"], [class*="picker"], [class*="carousel"], [class*="swiper"], [class*="slide"]');
          for (const el of candidates) {
            const text = el.textContent?.trim() || '';
            // Look for short text elements
            if (text.length > 0 && text.length < 25 && el.offsetWidth > 0) {
              results.push({
                tag: el.tagName,
                class: (el.className?.toString().substring?.(0, 60) || ''),
                text: text.substring(0, 25)
              });
            }
          }
          // Also look for any element containing day names
          const dayElements = document.querySelectorAll('*');
          for (const el of dayElements) {
            const text = el.textContent?.trim() || '';
            if (text.length < 15 && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Today|Tomorrow)/i.test(text)) {
              results.push({
                tag: el.tagName,
                class: (el.className?.toString().substring?.(0, 60) || ''),
                text: text,
                isDay: true
              });
            }
          }
          return results.slice(0, 25);
        })()
      `);
      console.log('Navigation elements found:', JSON.stringify(dateElements));

      // Try various selector patterns
      const selectors = [
        // Day number patterns
        `button:has-text("${dateDay}")`,
        `a:has-text("${dateDay}")`,
        `[role="tab"]:has-text("${dateDay}")`,
        `[class*="date"]:has-text("${dateDay}")`,
        `[class*="day"]:has-text("${dateDay}")`,
        `.swiper-slide:has-text("${dateDay}")`,
        // Day name + number patterns (e.g., "Sat 31" or "Saturday 31")
        `button:has-text("${dayName}")`,
        `a:has-text("${dayName}")`,
        `[class*="date"]:has-text("${dayName}")`,
        // Month + day patterns (e.g., "Jan 31")
        `button:has-text("${monthName} ${dateDay}")`,
        `a:has-text("${monthName} ${dateDay}")`,
      ];

      for (const selector of selectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const text = await element.textContent();
            // Make sure this element actually contains our target date
            if (text && (text.includes(String(dateDay)) || text.toLowerCase().includes(dayName.toLowerCase()))) {
              await element.click();
              await page.waitForTimeout(2000);
              console.log(`Selected date using selector: ${selector}, text: ${text?.trim()}`);
              return;
            }
          }
        } catch {
          continue;
        }
      }

      // Last resort: try clicking by exact text content
      try {
        const dateLink = await page.getByText(String(dateDay), { exact: true }).first();
        if (dateLink) {
          await dateLink.click();
          await page.waitForTimeout(2000);
          console.log(`Selected date using getByText("${dateDay}")`);
          return;
        }
      } catch {
        // Ignore
      }

      console.log('Could not find date selector, using default date');
    } catch (error) {
      console.log('Error selecting date:', error);
    }
  }

  private async clickOnMovieShowtimes(page: Page, movieTitle: string): Promise<boolean> {
    const searchTerms = [
      movieTitle.toLowerCase(),
      movieTitle.split(':')[0].toLowerCase(), // "Avatar" from "Avatar: Fire and Ash"
    ];

    try {
      // Strategy 1: Find a movie card containing our title and click its "Preview Showtimes" or similar button
      for (const term of searchTerms) {
        // Look for movie containers
        const movieCards = await page.$$('[class*="movie"], [class*="card"], [class*="film"], article');

        for (const card of movieCards) {
          const cardText = await card.textContent();
          if (cardText && cardText.toLowerCase().includes(term)) {
            // Found a card with our movie - look for showtime button inside
            const showtimeBtn = await card.$('button:has-text("Showtime"), a:has-text("Showtime"), button:has-text("Preview"), a:has-text("Preview")');
            if (showtimeBtn) {
              await showtimeBtn.click();
              console.log(`Clicked showtime button in movie card for: ${term}`);
              return true;
            }
            // No explicit showtime button, try clicking the card itself
            try {
              await card.click();
              console.log(`Clicked movie card for: ${term}`);
              return true;
            } catch {
              continue;
            }
          }
        }
      }

      // Strategy 2: Direct link/button with movie title
      for (const term of searchTerms) {
        const selectors = [
          `a:has-text("${term}")`,
          `button:has-text("${term}")`,
          `text="${term}"`,
        ];

        for (const selector of selectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              await element.click();
              console.log(`Clicked on movie using: ${selector}`);
              return true;
            }
          } catch {
            continue;
          }
        }
      }

      console.log('Could not find movie element to click');
      return false;
    } catch (error) {
      console.log('Error clicking movie:', error);
      return false;
    }
  }

  private async scrapeDOM(page: Page, movieTitle: string): Promise<ScrapedShowtime[]> {
    // Look for Megaplex-specific showtime elements
    const script = `
      (function() {
        const results = [];
        const seenTimes = new Set();

        // Strategy 1: Look for Megaplex showtime elements (mp-showing, time elements)
        const showtimeEls = document.querySelectorAll('time, [class*="mp-showing"], [class*="showtime"], article[class*="showing"]');
        for (const el of showtimeEls) {
          const text = el.textContent?.trim() || '';
          const timeMatch = text.match(/(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))/i);

          if (timeMatch) {
            const timeStr = timeMatch[1].toUpperCase();
            if (seenTimes.has(timeStr)) continue;
            seenTimes.add(timeStr);

            // Determine format from context
            let format = 'Standard';
            const context = text.toLowerCase();
            const parentContext = (el.closest('article, [class*="showing"]')?.textContent || '').toLowerCase();

            if (context.includes('imax') || parentContext.includes('imax')) format = 'IMAX';
            else if (context.includes('3d') || parentContext.includes('3d')) format = '3D';
            else if (context.includes('dolby') || parentContext.includes('dolby')) format = 'Dolby';
            else if (context.includes('atmos') || parentContext.includes('atmos')) format = 'Dolby Atmos';
            else if (context.includes('luxury') || parentContext.includes('luxury')) format = 'Luxury';

            results.push({ time: timeStr, format });
          }
        }

        // Strategy 2: Also check buttons/links
        if (results.length === 0) {
          const buttons = document.querySelectorAll('button, a, [role="button"]');
          for (const btn of buttons) {
            const text = btn.textContent?.trim() || '';
            const timeMatch = text.match(/(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))/i);

            if (timeMatch) {
              const timeStr = timeMatch[1].toUpperCase();
              if (seenTimes.has(timeStr)) continue;
              seenTimes.add(timeStr);
              results.push({ time: timeStr, format: 'Standard' });
            }
          }
        }

        // Strategy 3: Fallback - find any time patterns in page text
        if (results.length === 0) {
          const allText = document.body.innerText;
          const timeMatches = allText.match(/(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))/gi) || [];

          for (const timeStr of timeMatches) {
            const normalized = timeStr.toUpperCase();
            if (seenTimes.has(normalized)) continue;
            seenTimes.add(normalized);
            results.push({ time: normalized, format: 'Standard' });
          }
        }

        return results;
      })()
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
