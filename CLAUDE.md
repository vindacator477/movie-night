# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Movie Night Coordinator - a full-stack web app for groups to coordinate movie nights through collaborative voting on dates, movies, and showtimes with real-time synchronization.

## Commands

### Backend (from `backend/` directory)
```bash
npm run dev      # Start dev server with hot reload (port 3001)
npm run build    # Compile TypeScript to dist/
npm start        # Run production server
npm run lint     # ESLint check
```

### Frontend (from `frontend/` directory)
```bash
npm run dev      # Start Vite dev server (port 3000)
npm run build    # TypeScript + Vite build
npm run lint     # ESLint check
```

### Docker
```bash
docker-compose up --build    # Build & start all services
docker-compose up postgres   # Start only database
```

**Development:** Run `npm run dev` in both frontend and backend directories simultaneously.

## Architecture

### Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack React Query, Socket.io-client
- **Backend:** Node.js, Express, TypeScript, PostgreSQL 15, Socket.io, Playwright (scraping)
- **Infrastructure:** Docker, nginx

### Session Workflow State Machine
```
voting_dates → voting_movies → selecting_location → viewing_showtimes → completed
```

SessionView.tsx manages this workflow, delegating to step-specific components (DateVoting, MovieVoting, LocationInput, ShowtimeDisplay, CompletedSummary).

### Real-time Updates
Socket.io rooms are keyed by session ID. When any participant makes changes, the backend broadcasts to all clients in that session room. Frontend hooks (`useSocket.ts`) handle connection and event subscriptions.

### Data Flow
1. Frontend `api/client.ts` provides typed fetch wrapper for all endpoints
2. Backend routes in `routes/` handle API logic and emit socket events
3. PostgreSQL stores sessions, participants, votes, and cached showtimes
4. TanStack Query manages client-side caching with 5-min stale time

### Key Integrations
- **TMDb API** (`services/tmdb.ts`): Movie data and posters (requires `TMDB_API_KEY`)
- **Gracenote** (`services/gracenote.ts`): Showtime data source
- **Google Places** (`services/places.ts`): Optional theater search enhancement

### Database
Schema in `database/init.sql`. Core tables: sessions, participants, date_options, date_votes, movie_options, movie_votes, movie_rankings, showtime_votes, showtime_cache.

Auto-cleanup functions remove sessions older than 30 days and expired cache entries.

## Environment Variables

Required:
- `TMDB_API_KEY` - TMDb API access
- `DATABASE_URL` - PostgreSQL connection string (or individual POSTGRES_* vars)

Optional:
- `GOOGLE_PLACES_API_KEY` - Enhanced theater search
- `GRACENOTE_API_KEY` - Showtime data

## Ports
- Frontend dev: 3000
- Backend API: 3001
- PostgreSQL: 5432

## Conventions

- **Room codes:** 4-character uppercase alphanumeric (e.g., "M8X2")
- **IDs:** PostgreSQL-generated UUIDs
- **Dates:** ISO 8601 strings in API, Date objects in backend models
- **Showtime caching:** TTL-based (default 6 hours) to reduce scraping load
