# Movie Night Coordinator

A web application for groups of friends to coordinate movie nights together, with voting on dates/movies and Utah theater showtime lookups.

## Features

- **Create Sessions**: Start a new movie night coordination session
- **Date Voting**: Propose and vote on available dates
- **Movie Voting**: Browse now-playing movies or search TMDb, then vote
- **Location-Based Theater Search**: Find Utah theaters by ZIP code or city
- **Showtime Lookup**: Scrape Megaplex and Cinemark for showtimes
- **Real-time Updates**: See votes update live via WebSockets

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + React Query
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 15
- **Real-time**: Socket.io
- **Scraping**: Playwright
- **Containerization**: Docker

## Prerequisites

- Docker and Docker Compose
- TMDb API Key (get one at https://www.themoviedb.org/settings/api)
- (Optional) Google Places API Key for enhanced theater search

## Quick Start

1. **Clone and setup environment**:
   ```bash
   cd movie-night
   cp .env.example .env
   ```

2. **Add your API keys** to `.env`:
   ```
   TMDB_API_KEY=your_tmdb_api_key_here
   ```

3. **Build and run**:
   ```bash
   docker-compose up --build
   ```

4. **Access the app**:
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

## Development

### Running locally without Docker

**Backend**:
```bash
cd backend
npm install
npm run dev
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

**Database**:
```bash
# Start PostgreSQL container only
docker-compose up postgres
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Database user | movienight |
| `POSTGRES_PASSWORD` | Database password | movienight123 |
| `POSTGRES_DB` | Database name | movienight |
| `TMDB_API_KEY` | TMDb API key | (required) |
| `GOOGLE_PLACES_API_KEY` | Google Places API key | (optional) |
| `SHOWTIME_CACHE_TTL_HOURS` | How long to cache showtimes | 6 |
| `SCRAPE_RATE_LIMIT_MS` | Delay between scrape requests | 2000 |

## Architecture

```
movie-night/
├── docker-compose.yml      # Container orchestration
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── api/            # API client
│   │   └── types/          # TypeScript types
│   └── Dockerfile
├── backend/                # Express API server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── scrapers/       # Theater scrapers
│   │   └── socket/         # WebSocket handlers
│   └── Dockerfile
└── database/
    └── init.sql            # Database schema
```

## API Endpoints

### Sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/:id/join` - Join session
- `PATCH /api/sessions/:id/advance` - Advance to next step
- `PATCH /api/sessions/:id/location` - Set location

### Voting
- `POST /api/sessions/:id/dates` - Add date options
- `POST /api/sessions/:id/dates/:dateId/vote` - Vote for date
- `POST /api/sessions/:id/movies` - Add movie option
- `POST /api/sessions/:id/movies/:movieId/vote` - Vote for movie

### Movies
- `GET /api/movies/now-playing` - Get now playing movies
- `GET /api/movies/search?q=` - Search movies
- `GET /api/movies/:tmdbId` - Get movie details

### Theaters & Showtimes
- `GET /api/theaters?zip=&city=` - Search theaters
- `GET /api/showtimes?movie=&date=` - Get showtimes

## Session Workflow

1. **Create Session** - Generate a shareable link
2. **Join Session** - Participants enter their names
3. **Vote on Dates** - Everyone votes for available dates
4. **Vote on Movies** - Browse and vote for movies
5. **Select Location** - Enter Utah location
6. **View Showtimes** - See available showtimes

## Supported Theaters

- **Megaplex Theatres** - 10+ Utah locations
- **Cinemark** - 6+ Utah locations

## Troubleshooting

### Showtimes not loading
- Theater websites may have changed their structure
- Try a different theater chain
- Check the backend logs for scraping errors

### WebSocket connection issues
- Ensure port 3001 is accessible
- Check browser console for connection errors

### Database connection errors
- Verify PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in environment variables

## License

MIT
