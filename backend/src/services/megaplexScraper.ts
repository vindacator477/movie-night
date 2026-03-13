import { ShowtimeResult, ShowtimeInfo } from '../models/index.js';

// Megaplex theater configurations with their API cinema IDs
const MEGAPLEX_THEATERS: Record<string, { cinemaId: string; name: string }> = {
  'jordan-commons': {
    cinemaId: '0001',
    name: 'Megaplex Jordan Commons',
  },
  'lehi': {
    cinemaId: '0003',
    name: 'Megaplex Thanksgiving Point',
  },
};

interface MegaplexSession {
  id: string;
  showtime: string;  // ISO datetime e.g., "2026-03-13T14:30:00"
  seatsAvailable: number;
  screenNumber: number;
  sessionAttributesNames: string[];  // e.g., ["2D", "IMAX", "3D", "Luxury"]
}

interface MegaplexFilm {
  id: string;
  title: string;
  scheduledFilmId: string;
  sessions: MegaplexSession[];
}

const MEGAPLEX_API_BASE = 'https://apiv2.megaplex.com/api';

export class MegaplexScraper {
  async getShowtimes(params: {
    movieTitle: string;
    date: Date;
    theaters?: string[];
  }): Promise<ShowtimeResult[]> {
    const { movieTitle, date, theaters = ['jordan-commons'] } = params;
    const results: ShowtimeResult[] = [];

    for (const theaterId of theaters) {
      const theaterConfig = MEGAPLEX_THEATERS[theaterId];
      if (!theaterConfig) continue;

      try {
        const showtimes = await this.fetchTheaterShowtimes(
          theaterConfig.cinemaId,
          theaterConfig.name,
          movieTitle,
          date
        );
        if (showtimes) {
          results.push(showtimes);
        }
      } catch (error) {
        console.error(`Error fetching ${theaterConfig.name}:`, error);
      }
    }

    return results;
  }

  private async fetchTheaterShowtimes(
    cinemaId: string,
    theaterName: string,
    movieTitle: string,
    date: Date
  ): Promise<ShowtimeResult | null> {
    const dateStr = date.toISOString().split('T')[0];
    const url = `${MEGAPLEX_API_BASE}/film/cinemaFilms/${cinemaId}?date=${dateStr}`;

    console.log(`Fetching Megaplex API: ${url} for "${movieTitle}"`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Megaplex API error: ${response.status}`);
        return null;
      }

      const films = await response.json() as MegaplexFilm[];

      if (!Array.isArray(films)) {
        console.error('Unexpected Megaplex API response format');
        return null;
      }

      // Find the matching movie (strict matching)
      const searchTitle = movieTitle.toLowerCase().trim();
      const matchingFilm = films.find(film => {
        if (!film.title) return false;
        const filmTitle = film.title.toLowerCase().trim();

        // Exact match
        if (filmTitle === searchTitle) return true;

        // Film title contains search (e.g., "Hoppers" matches "Hoppers: The Movie")
        if (filmTitle.includes(searchTitle)) return true;

        // Search contains film title only if film title is substantial (4+ chars)
        // This prevents matching single-letter or very short titles
        const baseFilmTitle = filmTitle.split(':')[0].trim();
        if (baseFilmTitle.length >= 4 && searchTitle.includes(baseFilmTitle)) return true;

        return false;
      });

      if (matchingFilm) {
        console.log(`Matched movie "${matchingFilm.title}" for search "${movieTitle}"`);
      }

      if (!matchingFilm) {
        console.log(`Movie "${movieTitle}" not found at ${theaterName}`);
        console.log(`Available movies: ${films.filter(f => f.title).map(f => f.title).slice(0, 10).join(', ')}`);
        return null;
      }

      if (!matchingFilm.sessions || matchingFilm.sessions.length === 0) {
        console.log(`No sessions for "${movieTitle}" at ${theaterName}`);
        return null;
      }

      // Filter sessions to only include the requested date
      const requestedDateStr = dateStr;  // "YYYY-MM-DD"
      const sessionsForDate = matchingFilm.sessions.filter(session => {
        const sessionDate = session.showtime.split('T')[0];
        return sessionDate === requestedDateStr;
      });

      if (sessionsForDate.length === 0) {
        console.log(`No sessions for "${movieTitle}" at ${theaterName} on ${requestedDateStr}`);
        return null;
      }

      // Convert sessions to ShowtimeInfo
      const times: ShowtimeInfo[] = sessionsForDate.map(session => {
        const dateTime = new Date(session.showtime);
        const timeStr = dateTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        // Determine format from session attributes
        const attrs = (session.sessionAttributesNames || []).map(a => a?.toLowerCase() || '');
        let format = 'Standard';
        if (attrs.includes('imax')) format = 'IMAX';
        else if (attrs.includes('3d')) format = '3D';
        else if (attrs.includes('dolby')) format = 'Dolby';
        else if (attrs.includes('luxury')) format = 'Luxury';

        return {
          time: timeStr,
          format,
          available: session.seatsAvailable > 0,
        };
      });

      // Sort by time
      times.sort((a, b) => this.parseTime(a.time) - this.parseTime(b.time));

      console.log(`Found ${times.length} showtimes for "${movieTitle}" at ${theaterName}`);

      return {
        theaterName,
        theaterAddress: '',
        times,
        bookingUrl: `https://megaplex.com/jordancommons`,
      };
    } catch (error) {
      console.error(`Error fetching from Megaplex API:`, error);
      return null;
    }
  }

  private parseTime(timeStr: string): number {
    const match = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
    if (!match) return 0;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const isPM = match[3].toLowerCase() === 'pm';

    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  // Keep these for API compatibility
  async init(): Promise<void> {}
  async close(): Promise<void> {}
}

// Singleton instance
let scraperInstance: MegaplexScraper | null = null;

export function getMegaplexScraper(): MegaplexScraper {
  if (!scraperInstance) {
    scraperInstance = new MegaplexScraper();
  }
  return scraperInstance;
}
