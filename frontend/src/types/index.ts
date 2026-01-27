export type SessionStatus =
  | 'voting_dates'
  | 'voting_movies'
  | 'selecting_location'
  | 'viewing_showtimes'
  | 'completed';

export interface Session {
  id: string;
  room_code: string | null;
  name: string | null;
  status: SessionStatus;
  admin_participant_id: string | null;
  selected_date: string | null;
  selected_movie_id: number | null;
  location_zip: string | null;
  location_city: string | null;
  created_at: string;
  updated_at: string;
  participants: Participant[];
  dateOptions: DateOptionWithVotes[];
  movieOptions: MovieOptionWithVotes[];
}

export interface Participant {
  id: string;
  session_id: string;
  name: string;
  created_at: string;
}

export interface DateOption {
  id: string;
  session_id: string;
  date: string;
}

export interface DateOptionWithVotes extends DateOption {
  votes: string[];
}

export interface MovieOption {
  id: string;
  session_id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  overview: string | null;
  release_date: string | null;
  vote_average: number | null;
}

export interface MovieOptionWithVotes extends MovieOption {
  votes: string[];
}

export interface TMDbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  backdrop_path: string | null;
}

export interface TMDbResponse {
  page: number;
  results: TMDbMovie[];
  total_pages: number;
  total_results: number;
}

export interface Theater {
  name: string;
  address: string;
  chain: string;
  distance?: number;
}

export interface ShowtimeInfo {
  time: string;
  format: string;
  available: boolean;
}

export interface ShowtimeResult {
  theaterName: string;
  theaterAddress: string;
  times: ShowtimeInfo[];
  bookingUrl: string | null;
}
