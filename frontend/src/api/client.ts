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
  fetchApi<{ id: string; room_code: string }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const getSession = (id: string) =>
  fetchApi<import('../types').Session>(`/sessions/${id}`);

export const getSessionByCode = (code: string) =>
  fetchApi<import('../types').Session>(`/sessions/code/${code}`);

export const joinSession = (sessionId?: string, roomCode?: string, name?: string) =>
  fetchApi<{ participant: import('../types').Participant; session: import('../types').Session; isNewSession: boolean }>('/sessions/join', {
    method: 'POST',
    body: JSON.stringify({ sessionId, roomCode, name }),
  });

export const advanceSession = (id: string, participantId: string) =>
  fetchApi<import('../types').Session>(`/sessions/${id}/advance`, {
    method: 'PATCH',
    body: JSON.stringify({ participantId }),
  });

export const goBackSession = (id: string, participantId: string) =>
  fetchApi<import('../types').Session>(`/sessions/${id}/goback`, {
    method: 'PATCH',
    body: JSON.stringify({ participantId }),
  });

export const setSessionLocation = (id: string, zip?: string, city?: string, date?: string) =>
  fetchApi<import('../types').Session>(`/sessions/${id}/location`, {
    method: 'PATCH',
    body: JSON.stringify({ zip, city, date }),
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

// Ranked choice voting
export const submitRankings = (
  sessionId: string,
  participantId: string,
  rankings: Array<{ tmdbId: number; title: string; posterPath: string | null; rank: number }>
) =>
  fetchApi(`/sessions/${sessionId}/rankings`, {
    method: 'POST',
    body: JSON.stringify({ participantId, rankings }),
  });

export const getRankings = (sessionId: string) =>
  fetchApi<Record<string, Array<{ tmdb_id: number; title: string; poster_path: string; rank: number }>>>(
    `/sessions/${sessionId}/rankings`
  );

export const getRankingsWinner = (sessionId: string) =>
  fetchApi<{
    winner: { tmdb_id: number; title: string; poster_path: string } | null;
    rounds: Array<{ counts: Record<number, number>; eliminated?: number }>;
  }>(`/sessions/${sessionId}/rankings/winner`);

// Movies (TMDb)
export const getNowPlaying = (page: number = 1) =>
  fetchApi<import('../types').TMDbResponse>(`/movies/now-playing?page=${page}`);

// Get movies showing locally (based on actual theater showtimes)
export const getLocalMovies = (zip?: string, date?: string) =>
  fetchApi<import('../types').TMDbResponse>(
    `/movies/local?${zip ? `zip=${zip}` : ''}${date ? `&date=${date}` : ''}`
  );

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
  zip?: string;
  city?: string;
  theater?: string;
  chain?: string;
}) =>
  fetchApi<import('../types').ShowtimeResult[]>(
    `/showtimes?movie=${encodeURIComponent(params.movie)}&date=${params.date}${
      params.zip ? `&zip=${params.zip}` : ''
    }${params.city ? `&city=${encodeURIComponent(params.city)}` : ''
    }${params.theater ? `&theater=${encodeURIComponent(params.theater)}` : ''
    }${params.chain ? `&chain=${params.chain}` : ''}`
  );

// Showtime voting
export const voteForShowtime = (
  sessionId: string,
  participantId: string,
  theaterName: string,
  showtime: string,
  format: string
) =>
  fetchApi(`/sessions/${sessionId}/showtimes/vote`, {
    method: 'POST',
    body: JSON.stringify({ participantId, theaterName, showtime, format }),
  });

export const getShowtimeVotes = (sessionId: string) =>
  fetchApi<{
    votes: Array<{ participant_id: string; theater_name: string; showtime: string; format: string }>;
    voteCounts: Array<{ theaterName: string; showtime: string; format: string; count: number; voters: string[] }>;
    winner: { theaterName: string; showtime: string; format: string; count: number; voters: string[] } | null;
  }>(`/sessions/${sessionId}/showtimes/votes`);

export const removeShowtimeVote = (sessionId: string, participantId: string) =>
  fetchApi(`/sessions/${sessionId}/showtimes/vote`, {
    method: 'DELETE',
    body: JSON.stringify({ participantId }),
  });
