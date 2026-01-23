import { BaseScraper, ScraperParams } from './base.js';
import { ShowtimeResult, ShowtimeInfo } from '../models/index.js';

export class MegaplexScraper extends BaseScraper {
  private baseUrl = 'https://www.megaplextheatres.com';

  async getShowtimes(params: ScraperParams): Promise<ShowtimeResult[]> {
    const { movieTitle, date, theaterName } = params;
    const results: ShowtimeResult[] = [];

    await this.rateLimit();

    const { page, context } = await this.getPage();

    try {
      // Navigate to showtimes page
      const dateStr = this.formatDate(date);
      const url = `${this.baseUrl}/showtimes?date=${dateStr}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Get all theater sections
      const theaterSections = await page.$$('[data-theater-name], .theater-section, .location-card');

      for (const section of theaterSections) {
        try {
          // Get theater name
          const theaterNameEl = await section.$('.theater-name, .location-name, h2, h3');
          const currentTheaterName = theaterNameEl
            ? await theaterNameEl.textContent()
            : null;

          if (!currentTheaterName) continue;

          // Filter by specific theater if requested
          if (theaterName && !currentTheaterName.toLowerCase().includes(theaterName.toLowerCase())) {
            continue;
          }

          // Find movies in this theater
          const movieCards = await section.$$('.movie-card, .film-card, [data-movie-title]');

          for (const movieCard of movieCards) {
            const movieTitleEl = await movieCard.$('.movie-title, .film-title, h4');
            const cardTitle = movieTitleEl ? await movieTitleEl.textContent() : null;

            if (!cardTitle || !this.titleMatches(cardTitle, movieTitle)) continue;

            // Get showtimes for this movie
            const showtimeElements = await movieCard.$$('.showtime, .time-btn, [data-showtime]');
            const times: ShowtimeInfo[] = [];

            for (const showtimeEl of showtimeElements) {
              const timeText = await showtimeEl.textContent();
              if (!timeText) continue;

              const formatEl = await showtimeEl.$('.format');
              const format = await showtimeEl.getAttribute('data-format') ||
                (formatEl ? await formatEl.textContent() : null) ||
                'Standard';

              const isDisabled = await showtimeEl.getAttribute('disabled') !== null ||
                (await showtimeEl.getAttribute('class'))?.includes('sold-out');

              times.push({
                time: timeText.trim(),
                format: format?.trim() || 'Standard',
                available: !isDisabled,
              });
            }

            if (times.length > 0) {
              // Try to get booking URL
              const bookingLink = await movieCard.$('a[href*="buy"], a[href*="ticket"]');
              const bookingUrl = bookingLink ? await bookingLink.getAttribute('href') : null;

              // Get theater address
              const addressEl = await section.$('.address, .theater-address');
              const address = addressEl ? await addressEl.textContent() : '';

              results.push({
                theaterName: currentTheaterName.trim(),
                theaterAddress: address?.trim() || '',
                times,
                bookingUrl: bookingUrl ? `${this.baseUrl}${bookingUrl}` : null,
              });
            }
          }
        } catch (err) {
          console.error('Error parsing theater section:', err);
        }
      }

      // If no results from parsing, try alternative method
      if (results.length === 0) {
        // Try searching for the movie directly
        const searchUrl = `${this.baseUrl}/movies`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        const movieLinks = await page.$$('a[href*="/movies/"]');

        for (const link of movieLinks) {
          const linkText = await link.textContent();
          if (linkText && this.titleMatches(linkText, movieTitle)) {
            const href = await link.getAttribute('href');
            if (href) {
              await page.goto(`${this.baseUrl}${href}?date=${dateStr}`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
              });

              // Parse movie page for showtimes
              const locationCards = await page.$$('.location-showtimes, .theater-showtimes');

              for (const card of locationCards) {
                const locName = await card.$('.location-name, .theater-name');
                const locNameText = locName ? await locName.textContent() : 'Unknown Theater';

                if (theaterName && !locNameText?.toLowerCase().includes(theaterName.toLowerCase())) {
                  continue;
                }

                const showtimes = await card.$$('.showtime, .time');
                const times: ShowtimeInfo[] = [];

                for (const st of showtimes) {
                  const timeText = await st.textContent();
                  if (timeText) {
                    times.push({
                      time: timeText.trim(),
                      format: 'Standard',
                      available: true,
                    });
                  }
                }

                if (times.length > 0) {
                  results.push({
                    theaterName: locNameText?.trim() || 'Megaplex Theatre',
                    theaterAddress: '',
                    times,
                    bookingUrl: `${this.baseUrl}${href}`,
                  });
                }
              }

              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Megaplex scraping error:', error);
    } finally {
      await context.close();
    }

    return results;
  }
}
