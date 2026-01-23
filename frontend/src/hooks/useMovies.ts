import { useQuery } from '@tanstack/react-query';
import * as api from '../api/client';

export function useNowPlaying(page: number = 1) {
  return useQuery({
    queryKey: ['movies', 'now-playing', page],
    queryFn: () => api.getNowPlaying(page),
  });
}

export function useMovieSearch(query: string, page: number = 1) {
  return useQuery({
    queryKey: ['movies', 'search', query, page],
    queryFn: () => api.searchMovies(query, page),
    enabled: query.length >= 2,
  });
}

export function useMovieDetails(tmdbId: number | null) {
  return useQuery({
    queryKey: ['movies', tmdbId],
    queryFn: () => api.getMovieDetails(tmdbId!),
    enabled: !!tmdbId,
  });
}

export function useTheaters(zip?: string, city?: string) {
  return useQuery({
    queryKey: ['theaters', zip, city],
    queryFn: () => api.searchTheaters(zip, city),
    enabled: !!(zip || city),
  });
}

export function useShowtimes(params: {
  movie: string;
  date: string;
  theater?: string;
  chain?: string;
} | null) {
  return useQuery({
    queryKey: ['showtimes', params],
    queryFn: () => api.getShowtimes(params!),
    enabled: !!params && !!params.movie && !!params.date,
  });
}
