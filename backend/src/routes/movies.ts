import { Router, Request, Response } from 'express';
import { TMDbService } from '../services/tmdb.js';

const router = Router();
const tmdbService = new TMDbService();

// Get now playing movies
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
