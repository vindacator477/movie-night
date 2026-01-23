import { query } from '../config/database.js';
import { ShowtimeResult, ShowtimeCache, ShowtimeInfo } from '../models/index.js';

export class CacheService {
  private ttlHours: number;

  constructor() {
    this.ttlHours = parseInt(process.env.SHOWTIME_CACHE_TTL_HOURS || '6');
  }

  async getShowtimes(
    chain: string,
    theaterName: string,
    movieTitle: string,
    date: Date
  ): Promise<ShowtimeResult | null> {
    try {
      const result = await query<ShowtimeCache>(
        `SELECT * FROM showtime_cache
         WHERE theater_chain = $1
         AND theater_name = $2
         AND movie_title = $3
         AND showtime_date = $4
         AND expires_at > NOW()`,
        [chain, theaterName, movieTitle, date]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const cached = result.rows[0];
      return {
        theaterName: cached.theater_name,
        theaterAddress: cached.theater_address || '',
        times: cached.showtimes,
        bookingUrl: cached.booking_url,
      };
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  async setShowtimes(
    chain: string,
    theaterName: string,
    movieTitle: string,
    date: Date,
    result: ShowtimeResult
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.ttlHours);

      await query(
        `INSERT INTO showtime_cache
         (theater_chain, theater_name, theater_address, movie_title, showtime_date, showtimes, booking_url, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (theater_chain, theater_name, movie_title, showtime_date)
         DO UPDATE SET
           showtimes = EXCLUDED.showtimes,
           booking_url = EXCLUDED.booking_url,
           fetched_at = NOW(),
           expires_at = EXCLUDED.expires_at`,
        [chain, theaterName, result.theaterAddress, movieTitle, date,
         JSON.stringify(result.times), result.bookingUrl, expiresAt]
      );
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  async clearExpired(): Promise<number> {
    try {
      const result = await query(
        'DELETE FROM showtime_cache WHERE expires_at < NOW()'
      );
      return result.rowCount || 0;
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }
}
