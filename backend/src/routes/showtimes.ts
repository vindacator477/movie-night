import { Router, Request, Response } from 'express';
import { MegaplexScraper } from '../scrapers/megaplex.js';
import { CinemarkScraper } from '../scrapers/cinemark.js';
import { CacheService } from '../services/cache.js';
import { ShowtimeResult } from '../models/index.js';

const router = Router();
const megaplexScraper = new MegaplexScraper();
const cinemarkScraper = new CinemarkScraper();
const cacheService = new CacheService();

// Get showtimes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { theater, movie, date, chain } = req.query;

    if (!movie || !date) {
      return res.status(400).json({ error: 'Movie and date are required' });
    }

    const movieTitle = movie as string;
    const showtimeDate = new Date(date as string);
    const theaterChain = chain as string | undefined;
    const theaterName = theater as string | undefined;

    // Check cache first
    const cached = await cacheService.getShowtimes(
      theaterChain || 'all',
      theaterName || 'all',
      movieTitle,
      showtimeDate
    );

    if (cached) {
      return res.json(cached);
    }

    const results: ShowtimeResult[] = [];

    // Scrape from requested chain or all chains
    if (!theaterChain || theaterChain === 'megaplex') {
      try {
        const megaplexResults = await megaplexScraper.getShowtimes({
          movieTitle,
          date: showtimeDate,
          theaterName,
        });
        results.push(...megaplexResults);
      } catch (err) {
        console.error('Megaplex scraping error:', err);
      }
    }

    if (!theaterChain || theaterChain === 'cinemark') {
      try {
        const cinemarkResults = await cinemarkScraper.getShowtimes({
          movieTitle,
          date: showtimeDate,
          theaterName,
        });
        results.push(...cinemarkResults);
      } catch (err) {
        console.error('Cinemark scraping error:', err);
      }
    }

    // Cache results
    for (const result of results) {
      await cacheService.setShowtimes(
        theaterChain || 'all',
        result.theaterName,
        movieTitle,
        showtimeDate,
        result
      );
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching showtimes:', error);
    res.status(500).json({ error: 'Failed to fetch showtimes' });
  }
});

export default router;
