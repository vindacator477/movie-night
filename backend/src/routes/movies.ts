import { Router, Request, Response } from 'express';
import { TMDbService } from '../services/tmdb.js';
import { GracenoteService } from '../services/gracenote.js';

const router = Router();
const tmdbService = new TMDbService();
const gracenoteApiKey = process.env.GRACENOTE_API_KEY || '';
const gracenoteService = new GracenoteService(gracenoteApiKey);

// Get movies showing locally (from Gracenote, enriched with TMDb data)
router.get('/local', async (req: Request, res: Response) => {
  try {
    const zip = (req.query.zip as string) || '84070';
    const dateStr = req.query.date as string;
    const date = dateStr ? new Date(dateStr) : new Date();

    if (!gracenoteApiKey) {
      // Fallback to TMDb now-playing if Gracenote not configured
      console.log('Gracenote not configured, falling back to TMDb now-playing');
      const movies = await tmdbService.getNowPlaying(1);
      return res.json(movies);
    }

    // Get movies showing locally from Gracenote
    const localMovies = await gracenoteService.getLocalMovies({ date, zip, radius: 20 });

    if (localMovies.length === 0) {
      // Fallback to TMDb if no local movies found
      const movies = await tmdbService.getNowPlaying(1);
      return res.json(movies);
    }

    // Look up each movie in TMDb to get poster and details
    const tmdbResults = await Promise.all(
      localMovies.slice(0, 20).map(async (localMovie) => {
        try {
          const searchResult = await tmdbService.searchMovies(localMovie.title, 1);
          if (searchResult.results && searchResult.results.length > 0) {
            // Find best match by title and year
            const match = searchResult.results.find(r => {
              const titleMatch = r.title.toLowerCase() === localMovie.title.toLowerCase();
              const yearMatch = !localMovie.releaseYear ||
                (r.release_date && r.release_date.startsWith(String(localMovie.releaseYear)));
              return titleMatch || (r.title.toLowerCase().includes(localMovie.title.toLowerCase()) && yearMatch);
            }) || searchResult.results[0];

            return {
              ...match,
              theaterCount: localMovie.theaterCount,
              isLocal: true,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    // Filter out nulls and format response
    const results = tmdbResults.filter(m => m !== null);

    console.log(`Returning ${results.length} local movies with TMDb data`);

    res.json({
      page: 1,
      results,
      total_pages: 1,
      total_results: results.length,
    });
  } catch (error) {
    console.error('Error fetching local movies:', error);
    res.status(500).json({ error: 'Failed to fetch local movies' });
  }
});

// Get now playing movies (TMDb - national list)
router.get('/now-playing', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const movies = await tmdbService.getNowPlaying(page);
    res.json(movies);
  } catch (error) {
    console.error('Error fetching now playing:', error);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Search movies
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const movies = await tmdbService.searchMovies(query, page);
    res.json(movies);
  } catch (error) {
    console.error('Error searching movies:', error);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Get movie details
router.get('/:tmdbId', async (req: Request, res: Response) => {
  try {
    const tmdbId = parseInt(req.params.tmdbId);
    if (isNaN(tmdbId)) {
      return res.status(400).json({ error: 'Invalid movie ID' });
    }

    const movie = await tmdbService.getMovieDetails(tmdbId);
    res.json(movie);
  } catch (error) {
    console.error('Error fetching movie details:', error);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

export default router;
