import { BaseScraper, ScraperParams } from './base.js';
import { ShowtimeResult, ShowtimeInfo } from '../models/index.js';

export class CinemarkScraper extends BaseScraper {
  private baseUrl = 'https://www.cinemark.com';

  // Utah Cinemark theater slugs
  private utahTheaters = [
    { slug: 'ut-draper/draper-and-xd', name: 'Cinemark Draper and XD' },
    { slug: 'ut-orem/university-mall', name: 'Cinemark University Mall' },
    { slug: 'ut-provo/16-provo', name: 'Cinemark 16 Provo' },
    { slug: 'ut-salt-lake-city/sugarhouse', name: 'Cinemark Sugarhouse' },
    { slug: 'ut-logan/movies-10', name: 'Cinemark Movies 10' },
    { slug: 'ut-st-george/st-george-and-xd', name: 'Cinemark St. George' },
  ];

  async getShowtimes(params: ScraperParams): Promise<ShowtimeResult[]> {
    const { movieTitle, date, theaterName } = params;
    const results: ShowtimeResult[] = [];

    // Filter theaters if specific one requested
    const theatersToCheck = theaterName
      ? this.utahTheaters.filter(t =>
          t.name.toLowerCase().includes(theaterName.toLowerCase()))
      : this.utahTheaters;

    for (const theater of theatersToCheck) {
      await this.rateLimit();

      const { page, context } = await this.getPage();

      try {
        const dateStr = this.formatDate(date);
        const url = `${this.baseUrl}/theatres/${theater.slug}?showDate=${dateStr}`;

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Look for movie sections
        const movieSections = await page.$$('.movie-container, .movie-info, [data-movie]');

        for (const section of movieSections) {
          try {
            const titleEl = await section.$('.movie-name, .movie-title, h3');
            const sectionTitle = titleEl ? await titleEl.textContent() : null;

            if (!sectionTitle || !this.titleMatches(sectionTitle, movieTitle)) continue;

            // Get showtimes
            const showtimeButtons = await section.$$('.showtime-btn, .showtime, button[data-showtime]');
            const times: ShowtimeInfo[] = [];

            for (const btn of showtimeButtons) {
              const timeText = await btn.textContent();
              if (!timeText) continue;

              // Check for format indicators
              const btnClass = await btn.getAttribute('class') || '';
              const dataFormat = await btn.getAttribute('data-format') || '';

              let format = 'Standard';
              if (btnClass.includes('xd') || dataFormat.includes('xd')) format = 'XD';
              else if (btnClass.includes('imax') || dataFormat.includes('imax')) format = 'IMAX';
              else if (btnClass.includes('3d') || dataFormat.includes('3d')) format = '3D';

              const isDisabled = await btn.getAttribute('disabled') !== null;

              times.push({
                time: timeText.trim().replace(/[^0-9:apmAPM\s]/g, '').trim(),
                format,
                available: !isDisabled,
              });
            }

            if (times.length > 0) {
              // Get theater address
              const addressEl = await page.$('.theatre-address, .address');
              const address = addressEl ? await addressEl.textContent() : '';

              results.push({
                theaterName: theater.name,
                theaterAddress: address?.trim() || '',
                times,
                bookingUrl: url,
              });
            }

            break; // Found the movie, no need to check more sections
          } catch (err) {
            console.error('Error parsing movie section:', err);
          }
        }

        // Alternative: Try API endpoint if available
        if (results.length === 0) {
          try {
            const apiResponse = await page.evaluate(async (params) => {
              const { dateStr, theaterSlug } = params;
              const response = await fetch(
                `/api/theatres/${theaterSlug}/showtimes?date=${dateStr}`,
                { headers: { 'Accept': 'application/json' } }
              );
              if (response.ok) {
                return response.json();
              }
              return null;
            }, { dateStr, theaterSlug: theater.slug });

            if (apiResponse && Array.isArray((apiResponse as { movies?: unknown[] }).movies)) {
              for (const movie of (apiResponse as { movies: any[] }).movies) {
                if (this.titleMatches(movie.name || movie.title, movieTitle)) {
                  const times: ShowtimeInfo[] = (movie.showtimes || []).map((st: any) => ({
                    time: st.time || st.showtime,
                    format: st.format || 'Standard',
                    available: st.available !== false,
                  }));

                  if (times.length > 0) {
                    results.push({
                      theaterName: theater.name,
                      theaterAddress: movie.theaterAddress || '',
                      times,
                      bookingUrl: url,
                    });
                  }
                  break;
                }
              }
            }
          } catch (apiErr) {
            // API not available, continue with DOM parsing results
          }
        }
      } catch (error) {
        console.error(`Cinemark scraping error for ${theater.name}:`, error);
      } finally {
        await context.close();
      }
    }

    return results;
  }
}
