import { Router, Request, Response } from 'express';
import { GracenoteService } from '../services/gracenote.js';
import { CacheService } from '../services/cache.js';

const router = Router();
const cacheService = new CacheService();

// Initialize Gracenote service with API key from environment
const gracenoteApiKey = process.env.GRACENOTE_API_KEY || '';
const gracenoteService = new GracenoteService(gracenoteApiKey);

// Get showtimes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { movie, date, zip } = req.query;

    if (!movie || !date) {
      return res.status(400).json({ error: 'Movie and date are required' });
    }

    if (!gracenoteApiKey) {
      console.error('GRACENOTE_API_KEY not configured');
      return res.status(500).json({ error: 'Showtime service not configured' });
    }

    const movieTitle = movie as string;
    const showtimeDate = new Date(date as string);
    const zipCode = (zip as string) || '84101'; // Default to Salt Lake City

    // Check cache first
    const cacheKey = `gracenote:${movieTitle}:${showtimeDate.toISOString().split('T')[0]}:${zipCode}`;
    const cached = await cacheService.getShowtimes(
      'gracenote',
      zipCode,
      movieTitle,
      showtimeDate
    );

    if (cached) {
      console.log(`Cache hit for "${movieTitle}" showtimes`);
      return res.json(Array.isArray(cached) ? cached : [cached]);
    }

    console.log(`Fetching showtimes for "${movieTitle}" on ${showtimeDate.toISOString().split('T')[0]} near ${zipCode}`);

    // Fetch from Gracenote API
    const results = await gracenoteService.getShowtimes({
      movieTitle,
      date: showtimeDate,
      zip: zipCode,
      radius: 30,
    });

    // Cache results
    if (results.length > 0) {
      for (const result of results) {
        await cacheService.setShowtimes(
          'gracenote',
          result.theaterName,
          movieTitle,
          showtimeDate,
          result
        );
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching showtimes:', error);
    res.status(500).json({ error: 'Failed to fetch showtimes' });
  }
});

export default router;
