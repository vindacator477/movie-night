import { TMDbMovie } from '../models/index.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface TMDbResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface TMDbMovieDetails extends TMDbMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  videos?: {
    results: {
      key: string;
      site: string;
      type: string;
      official: boolean;
    }[];
  };
}

export class TMDbService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.TMDB_API_KEY || '';
    if (!this.apiKey) {
      console.warn('TMDB_API_KEY not set - movie features will be limited');
    }
  }

  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getNowPlaying(page: number = 1): Promise<TMDbResponse<TMDbMovie>> {
    return this.fetch<TMDbResponse<TMDbMovie>>('/movie/now_playing', {
      page: page.toString(),
      region: 'US',
    });
  }

  async searchMovies(query: string, page: number = 1): Promise<TMDbResponse<TMDbMovie>> {
    return this.fetch<TMDbResponse<TMDbMovie>>('/search/movie', {
      query,
      page: page.toString(),
      include_adult: 'false',
    });
  }

  async getMovieDetails(tmdbId: number): Promise<TMDbMovieDetails> {
    return this.fetch<TMDbMovieDetails>(`/movie/${tmdbId}`, {
      append_to_response: 'videos',
    });
  }

  getImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'original' = 'w342'): string | null {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }
}
