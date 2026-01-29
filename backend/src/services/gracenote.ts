import { ShowtimeResult, ShowtimeInfo } from '../models/index.js';

interface GracenoteShowtime {
  theatre: {
    id: string;
    name: string;
  };
  dateTime: string;
  ticketURI?: string;
  barg?: boolean;
  quals?: string;
}

interface GracenoteMovie {
  tmsId: string;
  title: string;
  releaseYear?: number;
  genres?: string[];
  longDescription?: string;
  shortDescription?: string;
  showtimes?: GracenoteShowtime[];
}

export interface LocalMovie {
  title: string;
  tmsId: string;
  releaseYear?: number;
  genres?: string[];
  description?: string;
  theaterCount: number;
}

export class GracenoteService {
  private apiKey: string;
  private baseUrl = 'https://data.tmsapi.com/v1.1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getShowtimes(params: {
    movieTitle: string;
    date: Date;
    zip?: string;
    radius?: number;
  }): Promise<ShowtimeResult[]> {
    const { movieTitle, date, zip = '84057', radius = 15 } = params;

    const dateStr = date.toISOString().split('T')[0];

    try {
      const url = new URL(`${this.baseUrl}/movies/showings`);
      url.searchParams.set('startDate', dateStr);
      url.searchParams.set('zip', zip);
      url.searchParams.set('radius', radius.toString());
      url.searchParams.set('api_key', this.apiKey);

      console.log(`Gracenote API request: ${url.toString().replace(this.apiKey, '***')}`);

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gracenote API error: ${response.status} - ${errorText}`);
        throw new Error(`Gracenote API error: ${response.status}`);
      }

      const movies = await response.json() as GracenoteMovie[];

      if (!Array.isArray(movies)) {
        console.error('Unexpected Gracenote response format');
        return [];
      }

      console.log(`Gracenote returned ${movies.length} movies`);

      // Find matching movie(s)
      const searchTitle = movieTitle.toLowerCase();
      const matchingMovies = movies.filter(m => this.titleMatches(m.title, searchTitle));

      console.log(`Found ${matchingMovies.length} movies matching "${movieTitle}"`);

      if (matchingMovies.length === 0) {
        // Log available titles for debugging
        const availableTitles = movies.slice(0, 10).map(m => m.title);
        console.log(`Available titles (first 10): ${availableTitles.join(', ')}`);
        return [];
      }

      // Group showtimes by theater
      const theaterMap = new Map<string, ShowtimeResult>();

      for (const movie of matchingMovies) {
        if (!movie.showtimes || !Array.isArray(movie.showtimes)) {
          continue;
        }

        for (const showtime of movie.showtimes) {
          if (!showtime.theatre) continue;

          const theaterId = showtime.theatre.id || showtime.theatre.name;

          let theaterResult = theaterMap.get(theaterId);
          if (!theaterResult) {
            theaterResult = {
              theaterName: showtime.theatre.name,
              theaterAddress: '',
              times: [],
              bookingUrl: null,
            };
            theaterMap.set(theaterId, theaterResult);
          }

          // Parse showtime
          const dateTime = new Date(showtime.dateTime);
          const timeStr = dateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          // Determine format from quals
          let format = 'Standard';
          const quals = (showtime.quals || '').toLowerCase();
          if (quals.includes('imax')) format = 'IMAX';
          else if (quals.includes('3d')) format = '3D';
          else if (quals.includes('dolby')) format = 'Dolby';
          else if (quals.includes('xd')) format = 'XD';

          // Also check movie title for format hints
          const titleLower = movie.title.toLowerCase();
          if (titleLower.includes('imax')) format = 'IMAX';
          else if (titleLower.includes('3d') && format === 'Standard') format = '3D';

          // Avoid duplicate times
          const existingTime = theaterResult.times.find(t => t.time === timeStr && t.format === format);
          if (!existingTime) {
            theaterResult.times.push({
              time: timeStr,
              format,
              available: true,
            });

            // Use first ticket URL found
            if (showtime.ticketURI && !theaterResult.bookingUrl) {
              theaterResult.bookingUrl = showtime.ticketURI;
            }
          }
        }
      }

      // Convert map to array and sort times
      const results = Array.from(theaterMap.values());
      for (const result of results) {
        result.times.sort((a, b) => this.parseTime(a.time) - this.parseTime(b.time));
      }

      console.log(`Gracenote found ${results.length} theaters with showtimes for "${movieTitle}"`);
      return results;

    } catch (error) {
      console.error('Gracenote API error:', error);
      return [];
    }
  }

  private titleMatches(apiTitle: string, searchTitle: string): boolean {
    const normalize = (s: string) => s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const normalizedApi = normalize(apiTitle);
    const normalizedSearch = normalize(searchTitle);

    // Check for exact match or containment
    if (normalizedApi === normalizedSearch) return true;
    if (normalizedApi.includes(normalizedSearch)) return true;
    if (normalizedSearch.includes(normalizedApi)) return true;

    // Check if the base title matches (ignore suffixes like "3D", "IMAX", etc.)
    const baseApi = normalizedApi.replace(/(3d|imax|an imax.*experience|the imax.*experience)$/g, '').trim();
    const baseSearch = normalizedSearch.replace(/(3d|imax|an imax.*experience|the imax.*experience)$/g, '').trim();

    if (baseApi === baseSearch) return true;
    if (baseApi.includes(baseSearch)) return true;
    if (baseSearch.includes(baseApi)) return true;

    return false;
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

  /**
   * Get all movies currently showing in local theaters
   */
  async getLocalMovies(params: {
    date: Date;
    zip?: string;
    radius?: number;
  }): Promise<LocalMovie[]> {
    const { date, zip = '84057', radius = 15 } = params;
    const dateStr = date.toISOString().split('T')[0];

    try {
      const url = new URL(`${this.baseUrl}/movies/showings`);
      url.searchParams.set('startDate', dateStr);
      url.searchParams.set('zip', zip);
      url.searchParams.set('radius', radius.toString());
      url.searchParams.set('api_key', this.apiKey);

      console.log(`Gracenote local movies request: ${url.toString().replace(this.apiKey, '***')}`);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Gracenote API error: ${response.status}`);
      }

      const movies = await response.json() as GracenoteMovie[];

      if (!Array.isArray(movies)) {
        return [];
      }

      // Deduplicate movies by base title (ignore 3D, IMAX variants)
      const movieMap = new Map<string, LocalMovie>();

      for (const movie of movies) {
        // Normalize title to group variants (e.g., "Avatar 3D" and "Avatar" become one entry)
        const baseTitle = movie.title
          .replace(/\s*[\(\[]?(3D|IMAX|An IMAX.*Experience|The IMAX.*Experience|Dolby Cinema)[\)\]]?\s*$/gi, '')
          .trim();

        const existing = movieMap.get(baseTitle.toLowerCase());

        // Count unique theaters showing this movie
        const theaters = new Set(movie.showtimes?.map(s => s.theatre?.id || s.theatre?.name) || []);

        if (existing) {
          // Merge theater counts
          existing.theaterCount = Math.max(existing.theaterCount, theaters.size);
        } else {
          movieMap.set(baseTitle.toLowerCase(), {
            title: baseTitle,
            tmsId: movie.tmsId,
            releaseYear: movie.releaseYear,
            genres: movie.genres,
            description: movie.shortDescription || movie.longDescription,
            theaterCount: theaters.size,
          });
        }
      }

      // Convert to array and sort by theater count (most popular first)
      const results = Array.from(movieMap.values())
        .sort((a, b) => b.theaterCount - a.theaterCount);

      console.log(`Found ${results.length} unique movies showing locally`);
      return results;

    } catch (error) {
      console.error('Error fetching local movies:', error);
      return [];
    }
  }
}
