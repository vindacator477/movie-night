-- Movie Night Coordinator Database Schema

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'voting_dates',
    -- statuses: voting_dates, voting_movies, selecting_location, viewing_showtimes, completed
    admin_participant_id UUID,
    selected_date DATE,
    selected_movie_id INTEGER,
    location_zip VARCHAR(10),
    location_city VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Participants (anonymous, just need a name per session)
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Date options for a session
CREATE TABLE date_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    UNIQUE(session_id, date)
);

-- Date votes
CREATE TABLE date_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_option_id UUID REFERENCES date_options(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    UNIQUE(date_option_id, participant_id)
);

-- Movie options for a session (cached from TMDb)
CREATE TABLE movie_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    overview TEXT,
    release_date DATE,
    vote_average DECIMAL(3,1),
    UNIQUE(session_id, tmdb_id)
);

-- Movie votes with ranking support
CREATE TABLE movie_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_option_id UUID REFERENCES movie_options(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    rank INTEGER DEFAULT 1,
    UNIQUE(movie_option_id, participant_id)
);

-- Movie rankings for ranked choice voting (stores user's ranked picks)
CREATE TABLE movie_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    rank INTEGER NOT NULL,
    UNIQUE(session_id, participant_id, rank)
);

-- Showtime votes (stores user's selected showtime)
CREATE TABLE showtime_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    theater_name VARCHAR(255) NOT NULL,
    showtime VARCHAR(20) NOT NULL,
    format VARCHAR(50) DEFAULT 'Standard',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, participant_id)
);

-- Cached showtimes (with TTL)
CREATE TABLE showtime_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theater_chain VARCHAR(50) NOT NULL,
    theater_name VARCHAR(255) NOT NULL,
    theater_address VARCHAR(500),
    movie_title VARCHAR(255) NOT NULL,
    showtime_date DATE NOT NULL,
    showtimes JSONB NOT NULL,
    booking_url VARCHAR(500),
    fetched_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(theater_chain, theater_name, movie_title, showtime_date)
);

-- Indexes
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_participants_session ON participants(session_id);
CREATE INDEX idx_date_options_session ON date_options(session_id);
CREATE INDEX idx_movie_options_session ON movie_options(session_id);
CREATE INDEX idx_showtime_cache_expires ON showtime_cache(expires_at);
CREATE INDEX idx_showtime_cache_lookup ON showtime_cache(theater_chain, showtime_date, movie_title);

-- Auto-cleanup function for expired sessions (30 days)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup function for expired showtime cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM showtime_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
