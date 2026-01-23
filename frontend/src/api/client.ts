const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}/api${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Sessions
export const createSession = (name?: string) =>
  fetchApi<{ id: string }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const getSession = (id: string) =>
  fetchApi<import('../types').Session>(`/sessions/${id}`);

export const joinSession = (id: string, name: string) =>
  fetchApi<import('../types').Participant>(`/sessions/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const advanceSession = (id: string, participantId: string) =>
  fetchApi<import('../types').Session>(`/sessions/${id}/advance`, {
    method: 'PATCH',
    body: JSON.stringify({ participantId }),
  });

export const setSessionLocation = (id: string, zip?: string, city?: string) =>
  fetchApi<import('../types').Session>(`/sessions/${id}/location`, {
    method: 'PATCH',
    body: JSON.stringify({ zip, city }),
  });

// Date voting
export const addDates = (sessionId: string, dates: string[]) =>
  fetchApi<import('../types').DateOption[]>(`/sessions/${sessionId}/dates`, {
    method: 'POST',
    body: JSON.stringify({ dates }),
  });

export const voteForDate = (sessionId: string, dateId: string, participantId: string) =>
  fetchApi(`/sessions/${sessionId}/dates/${dateId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  });

export const removeVoteForDate = (sessionId: string, dateId: string, participantId: string) =>
  fetchApi(`/sessions/${sessionId}/dates/${dateId}/vote`, {
    method: 'DELETE',
    body: JSON.stringify({ participantId }),
  });

// Movie voting
export const addMovie = (
  sessionId: string,
  movie: {
    tmdbId: number;
    title: string;
    posterPath: string | null;
    overview: string;
    releaseDate: string;
    voteAverage: number;
  }
) =>
  fetchApi(`/sessions/${sessionId}/movies`, {
    method: 'POST',
    body: JSON.stringify(movie),
  });

export const voteForMovie = (sessionId: string, movieId: string, participantId: string) =>
  fetchApi(`/sessions/${sessionId}/movies/${movieId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  });

export const removeVoteForMovie = (sessionId: string, movieId: string, participantId: string) =>
  fetchApi(`/sessions/${sessionId}/movies/${movieId}/vote`, {
    method: 'DELETE',
    body: JSON.stringify({ participantId }),
  });

// Movies (TMDb)
export const getNowPlaying = (page: number = 1) =>
  fetchApi<import('../types').TMDbResponse>(`/movies/now-playing?page=${page}`);

export const searchMovies = (query: string, page: number = 1) =>
  fetchApi<import('../types').TMDbResponse>(`/movies/search?q=${encodeURIComponent(query)}&page=${page}`);

export const getMovieDetails = (tmdbId: number) =>
  fetchApi<import('../types').TMDbMovie & { runtime: number; genres: { id: number; name: string }[] }>(
    `/movies/${tmdbId}`
  );

// Theaters & Showtimes
export const searchTheaters = (zip?: string, city?: string) =>
  fetchApi<import('../types').Theater[]>(
    `/theaters?${zip ? `zip=${zip}` : ''}${city ? `&city=${encodeURIComponent(city)}` : ''}`
  );

export const getShowtimes = (params: {
  movie: string;
  date: string;
  theater?: string;
  chain?: string;
}) =>
  fetchApi<import('../types').ShowtimeResult[]>(
    `/showtimes?movie=${encodeURIComponent(params.movie)}&date=${params.date}${
      params.theater ? `&theater=${encodeURIComponent(params.theater)}` : ''
    }${params.chain ? `&chain=${params.chain}` : ''}`
  );
