import { Router, Request, Response } from 'express';
import { GracenoteService } from '../services/gracenote.js';
import { CacheService } from '../services/cache.js';
import { getMegaplexScraper } from '../services/megaplexScraper.js';
import { ShowtimeResult } from '../models/index.js';

const router = Router();
const cacheService = new CacheService();

// Initialize Gracenote service with API key from environment
const gracenoteApiKey = process.env.GRACENOTE_API_KEY || '';
const gracenoteService = new GracenoteService(gracenoteApiKey);

// City to ZIP mapping for Utah cities
const cityToZip: Record<string, string> = {
  'sandy': '84070', 'salt lake city': '84101', 'draper': '84020',
  'south jordan': '84095', 'west jordan': '84084', 'lehi': '84043',
  'orem': '84057', 'provo': '84601', 'ogden': '84401',
  'layton': '84041', 'st. george': '84770', 'st george': '84770',
  'south salt lake': '84115', 'murray': '84107', 'centerville': '84014',
  'west valley': '84119', 'taylorsville': '84129', 'riverton': '84065',
  'herriman': '84096', 'cottonwood heights': '84121', 'holladay': '84117',
  'millcreek': '84109', 'sugarhouse': '84106', 'sugar house': '84106',
};

// Megaplex theaters we want to always include via scraping
const MEGAPLEX_THEATERS_TO_SCRAPE = ['jordan-commons', 'lehi'];

// Get showtimes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { movie, date, zip, city } = req.query;

    if (!movie || !date) {
      return res.status(400).json({ error: 'Movie and date are required' });
    }

    const movieTitle = movie as string;
    const showtimeDate = new Date(date as string);

    // Convert city to zip if needed
    let zipCode = zip as string;
    if (!zipCode && city) {
      const cityLower = (city as string).toLowerCase().trim();
      zipCode = cityToZip[cityLower] || '84070'; // Default to Sandy
    }
    if (!zipCode) {
      zipCode = '84070'; // Default to Sandy area
    }

    // Check cache first
    const cacheKey = `combined:${movieTitle}:${showtimeDate.toISOString().split('T')[0]}:${zipCode}`;
    const cached = await cacheService.getShowtimes(
      'combined',
      zipCode,
      movieTitle,
      showtimeDate
    );

    if (cached) {
      console.log(`Cache hit for "${movieTitle}" showtimes`);
      return res.json(Array.isArray(cached) ? cached : [cached]);
    }

    console.log(`Fetching showtimes for "${movieTitle}" on ${showtimeDate.toISOString().split('T')[0]} near ${zipCode}`);

    // Fetch from both sources in parallel
    const [gracenoteResults, megaplexResults] = await Promise.all([
      // Gracenote API
      gracenoteApiKey
        ? gracenoteService.getShowtimes({
            movieTitle,
            date: showtimeDate,
            zip: zipCode,
            radius: 15,
          }).catch(err => {
            console.error('Gracenote error:', err);
            return [] as ShowtimeResult[];
          })
        : Promise.resolve([] as ShowtimeResult[]),

      // Megaplex scraper for Jordan Commons and Lehi
      getMegaplexScraper().getShowtimes({
        movieTitle,
        date: showtimeDate,
        theaters: MEGAPLEX_THEATERS_TO_SCRAPE,
      }).catch(err => {
        console.error('Megaplex scraper error:', err);
        return [] as ShowtimeResult[];
      }),
    ]);

    // Merge results - Megaplex scraper results take priority for those theaters
    const megaplexNames = new Set(megaplexResults.map(r => r.theaterName.toLowerCase()));
    const filteredGracenote = gracenoteResults.filter(
      r => !megaplexNames.has(r.theaterName.toLowerCase()) &&
           !r.theaterName.toLowerCase().includes('jordan commons') &&
           !r.theaterName.toLowerCase().includes('lehi')
    );

    const results = [...megaplexResults, ...filteredGracenote];

    // Sort by theater name
    results.sort((a, b) => a.theaterName.localeCompare(b.theaterName));

    console.log(`Combined results: ${megaplexResults.length} from Megaplex scraper, ${filteredGracenote.length} from Gracenote`);

    // Cache combined results (cache each theater separately)
    if (results.length > 0) {
      for (const result of results) {
        await cacheService.setShowtimes(
          'combined',
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
