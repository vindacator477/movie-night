export interface Session {
  id: string;
  name: string | null;
  status: SessionStatus;
  admin_participant_id: string | null;
  selected_date: Date | null;
  selected_movie_id: number | null;
  location_zip: string | null;
  location_city: string | null;
  created_at: Date;
  updated_at: Date;
}

export type SessionStatus =
  | 'voting_dates'
  | 'voting_movies'
  | 'selecting_location'
  | 'viewing_showtimes'
  | 'completed';

export interface Participant {
  id: string;
  session_id: string;
  name: string;
  created_at: Date;
}

export interface DateOption {
  id: string;
  session_id: string;
  date: Date;
}

export interface DateVote {
  id: string;
  date_option_id: string;
  participant_id: string;
}

export interface MovieOption {
  id: string;
  session_id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  overview: string | null;
  release_date: Date | null;
  vote_average: number | null;
}

export interface MovieVote {
  id: string;
  movie_option_id: string;
  participant_id: string;
}

export interface ShowtimeCache {
  id: string;
  theater_chain: string;
  theater_name: string;
  theater_address: string | null;
  movie_title: string;
  showtime_date: Date;
  showtimes: ShowtimeInfo[];
  booking_url: string | null;
  fetched_at: Date;
  expires_at: Date;
}

export interface ShowtimeInfo {
  time: string;
  format: string;
  available: boolean;
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

export interface Theater {
  name: string;
  address: string;
  chain: string;
  distance?: number;
}

export interface ShowtimeResult {
  theaterName: string;
  theaterAddress: string;
  times: ShowtimeInfo[];
  bookingUrl: string | null;
}
