import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { Session, Participant, DateOption, MovieOption, SessionStatus } from '../models/index.js';
import { Server } from 'socket.io';
import { generateRoomCode, getUniqueRoomCode, isValidRoomCode } from './roomCode.js';

const router = Router();

// Create new session (legacy - still used but we'll also auto-create on join)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const roomCode = await getUniqueRoomCode(query);
    const result = await query<Session>(
      'INSERT INTO sessions (name, room_code) VALUES ($1, $2) RETURNING *',
      [name || null, roomCode]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session by room code
router.get('/code/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    
    if (!isValidRoomCode(code)) {
      return res.status(400).json({ error: 'Invalid room code format' });
    }

    const sessionResult = await query<Session>(
      'SELECT * FROM sessions WHERE room_code = $1',
      [code.toUpperCase()]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get full session details (same as GET /:id)
    const session = sessionResult.rows[0];
    const sessionId = session.id;

    // Get participants
    const participantsResult = await query<Participant>(
      'SELECT * FROM participants WHERE session_id = $1 ORDER BY created_at',
      [sessionId]
    );

    // Get date options with votes
    const dateOptionsResult = await query<DateOption & { votes: string[] }>(
      `SELECT d.*,
        COALESCE(array_agg(dv.participant_id) FILTER (WHERE dv.participant_id IS NOT NULL), '{}') as votes
       FROM date_options d
       LEFT JOIN date_votes dv ON d.id = dv.date_option_id
       WHERE d.session_id = $1
       GROUP BY d.id
       ORDER BY d.date`,
      [sessionId]
    );

    // Get movie options with votes
    const movieOptionsResult = await query<MovieOption & { votes: string[] }>(
      `SELECT m.*,
        COALESCE(array_agg(mv.participant_id) FILTER (WHERE mv.participant_id IS NOT NULL), '{}') as votes
       FROM movie_options m
       LEFT JOIN movie_votes mv ON m.id = mv.movie_option_id
       WHERE m.session_id = $1
       GROUP BY m.id
       ORDER BY m.title`,
      [sessionId]
    );

    res.json({
      ...session,
      participants: participantsResult.rows,
      dateOptions: dateOptionsResult.rows,
      movieOptions: movieOptionsResult.rows,
    });
  } catch (error) {
    console.error('Error getting session by code:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Get session details with all votes
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sessionResult = await query<Session>(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get participants
    const participantsResult = await query<Participant>(
      'SELECT * FROM participants WHERE session_id = $1 ORDER BY created_at',
      [id]
    );

    // Get date options with votes
    const dateOptionsResult = await query<DateOption & { votes: string[] }>(
      `SELECT d.*,
        COALESCE(array_agg(dv.participant_id) FILTER (WHERE dv.participant_id IS NOT NULL), '{}') as votes
       FROM date_options d
       LEFT JOIN date_votes dv ON d.id = dv.date_option_id
       WHERE d.session_id = $1
       GROUP BY d.id
       ORDER BY d.date`,
      [id]
    );

    // Get movie options with votes
    const movieOptionsResult = await query<MovieOption & { votes: string[] }>(
      `SELECT m.*,
        COALESCE(array_agg(mv.participant_id) FILTER (WHERE mv.participant_id IS NOT NULL), '{}') as votes
       FROM movie_options m
       LEFT JOIN movie_votes mv ON m.id = mv.movie_option_id
       WHERE m.session_id = $1
       GROUP BY m.id
       ORDER BY m.title`,
      [id]
    );

    res.json({
      ...session,
      participants: participantsResult.rows,
      dateOptions: dateOptionsResult.rows,
      movieOptions: movieOptionsResult.rows,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Join session (also creates session if it doesn't exist - for first user auto-create)
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { sessionId, roomCode, name } = req.body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let session: Session | null = null;
    let isNewSession = false;

    // Try to find session by ID or room code
    if (sessionId) {
      const sessionResult = await query<Session>(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );
      if (sessionResult.rows.length > 0) {
        session = sessionResult.rows[0];
      }
    } else if (roomCode) {
      const code = roomCode.toUpperCase();
      if (!isValidRoomCode(code)) {
        return res.status(400).json({ error: 'Invalid room code format' });
      }
      const sessionResult = await query<Session>(
        'SELECT * FROM sessions WHERE room_code = $1',
        [code]
      );
      if (sessionResult.rows.length > 0) {
        session = sessionResult.rows[0];
      }
    } else {
      // No sessionId or roomCode provided - create new session
      const roomCode = await getUniqueRoomCode(query);
      const sessionResult = await query<Session>(
        'INSERT INTO sessions (name, room_code, status) VALUES ($1, $2, $3) RETURNING *',
        ['Movie Night', roomCode, 'voting_movies']
      );
      session = sessionResult.rows[0];
      isNewSession = true;
    }

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check participant limit (max 20)
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM participants WHERE session_id = $1',
      [session.id]
    );

    if (parseInt(countResult.rows[0].count) >= 20) {
      return res.status(400).json({ error: 'Session is full (max 20 participants)' });
    }

    const result = await query<Participant>(
      'INSERT INTO participants (session_id, name) VALUES ($1, $2) RETURNING *',
      [session.id, name.trim()]
    );

    const newParticipant = result.rows[0];

    // If no admin set yet, make this participant the admin (first joiner)
    if (!session.admin_participant_id) {
      await query(
        'UPDATE sessions SET admin_participant_id = $1 WHERE id = $2',
        [newParticipant.id, session.id]
      );
      session.admin_participant_id = newParticipant.id;
    }

    const io: Server = req.app.get('io');
    io.to(session.id).emit('participant_joined', newParticipant);

    res.status(201).json({
      participant: newParticipant,
      session: session,
      isNewSession
    });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// Advance session state
router.patch('/:id/advance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { participantId } = req.body;

    const sessionResult = await query<Session>(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Check if the requester is the admin
    if (session.admin_participant_id && session.admin_participant_id !== participantId) {
      return res.status(403).json({ error: 'Only the session admin can advance the session' });
    }
    const statusOrder: SessionStatus[] = [
      'voting_dates',
      'voting_movies',
      'selecting_location',
      'viewing_showtimes',
      'completed'
    ];

    const currentIndex = statusOrder.indexOf(session.status);
    if (currentIndex === statusOrder.length - 1) {
      return res.status(400).json({ error: 'Session already completed' });
    }

    const newStatus = statusOrder[currentIndex + 1];
    let updateQuery = 'UPDATE sessions SET status = $1, updated_at = NOW()';
    const params: unknown[] = [newStatus];

    // If advancing from voting_dates, set the winning date
    if (session.status === 'voting_dates') {
      const winningDate = await query<{ date: Date }>(
        `SELECT d.date, COUNT(dv.id) as vote_count
         FROM date_options d
         LEFT JOIN date_votes dv ON d.id = dv.date_option_id
         WHERE d.session_id = $1
         GROUP BY d.id, d.date
         ORDER BY vote_count DESC, d.date ASC
         LIMIT 1`,
        [id]
      );

      if (winningDate.rows.length > 0) {
        updateQuery += ', selected_date = $3';
        params.push(winningDate.rows[0].date);
      }
    }

    // If advancing from voting_movies, calculate ranked choice winner
    if (session.status === 'voting_movies') {
      const rankingsResult = await query<{
        participant_id: string;
        tmdb_id: number;
        title: string;
        rank: number;
      }>(
        `SELECT participant_id, tmdb_id, title, rank
         FROM movie_rankings
         WHERE session_id = $1
         ORDER BY participant_id, rank`,
        [id]
      );

      if (rankingsResult.rows.length > 0) {
        // Group ballots by participant
        const ballots: Map<string, number[]> = new Map();
        const movieTitles: Map<number, string> = new Map();

        for (const row of rankingsResult.rows) {
          if (!ballots.has(row.participant_id)) {
            ballots.set(row.participant_id, []);
          }
          ballots.get(row.participant_id)!.push(row.tmdb_id);
          movieTitles.set(row.tmdb_id, row.title);
        }

        // Instant runoff voting
        let remainingCandidates = new Set(movieTitles.keys());
        let winnerId: number | null = null;

        while (remainingCandidates.size > 1 && !winnerId) {
          const counts: Record<number, number> = {};
          for (const candidate of remainingCandidates) {
            counts[candidate] = 0;
          }

          for (const ballot of ballots.values()) {
            for (const choice of ballot) {
              if (remainingCandidates.has(choice)) {
                counts[choice]++;
                break;
              }
            }
          }

          const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);

          // Check for majority winner
          for (const [candidate, count] of Object.entries(counts)) {
            if (count > totalVotes / 2) {
              winnerId = parseInt(candidate);
              break;
            }
          }

          if (!winnerId) {
            // Eliminate candidate with fewest votes
            let minVotes = Infinity;
            let toEliminate = 0;
            for (const [candidate, count] of Object.entries(counts)) {
              if (count < minVotes) {
                minVotes = count;
                toEliminate = parseInt(candidate);
              }
            }
            remainingCandidates.delete(toEliminate);
          }
        }

        // If no majority winner found, take last remaining
        if (!winnerId && remainingCandidates.size > 0) {
          winnerId = [...remainingCandidates][0];
        }

        if (winnerId) {
          updateQuery += ', selected_movie_id = $3';
          params.push(winnerId);
        }
      }
    }

    updateQuery += ' WHERE id = $2 RETURNING *';
    params.splice(1, 0, id);

    const result = await query<Session>(updateQuery, params);

    const io: Server = req.app.get('io');
    io.to(id).emit('session_advanced', result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error advancing session:', error);
    res.status(500).json({ error: 'Failed to advance session' });
  }
});

// Go back to previous session state
router.patch('/:id/goback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { participantId } = req.body;

    const sessionResult = await query<Session>(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Check if the requester is the admin
    if (session.admin_participant_id && session.admin_participant_id !== participantId) {
      return res.status(403).json({ error: 'Only the session admin can go back' });
    }

    const statusOrder: SessionStatus[] = [
      'voting_dates',
      'voting_movies',
      'selecting_location',
      'viewing_showtimes',
      'completed'
    ];

    const currentIndex = statusOrder.indexOf(session.status);
    if (currentIndex === 0) {
      return res.status(400).json({ error: 'Already at the first step' });
    }

    const newStatus = statusOrder[currentIndex - 1];

    // Clear selected values when going back
    let updateQuery = 'UPDATE sessions SET status = $1, updated_at = NOW()';
    const params: unknown[] = [newStatus];

    // Clear selected_date if going back to voting_dates
    if (newStatus === 'voting_dates') {
      updateQuery += ', selected_date = NULL';
    }

    // Clear selected_movie_id if going back to voting_movies
    if (newStatus === 'voting_movies') {
      updateQuery += ', selected_movie_id = NULL';
    }

    updateQuery += ' WHERE id = $2 RETURNING *';
    params.push(id);

    const result = await query<Session>(updateQuery, params);

    const io: Server = req.app.get('io');
    io.to(id).emit('session_updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error going back in session:', error);
    res.status(500).json({ error: 'Failed to go back' });
  }
});

// Set location
router.patch('/:id/location', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { zip, city } = req.body;

    const result = await query<Session>(
      `UPDATE sessions
       SET location_zip = $1, location_city = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [zip || null, city || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const io: Server = req.app.get('io');
    io.to(id).emit('location_updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error setting location:', error);
    res.status(500).json({ error: 'Failed to set location' });
  }
});

// Add date options
router.post('/:id/dates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dates } = req.body;

    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'Dates array is required' });
    }

    const results: DateOption[] = [];
    for (const date of dates) {
      try {
        const result = await query<DateOption>(
          'INSERT INTO date_options (session_id, date) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
          [id, date]
        );
        if (result.rows.length > 0) {
          results.push(result.rows[0]);
        }
      } catch (err) {
        // Skip duplicates
      }
    }

    const io: Server = req.app.get('io');
    io.to(id).emit('date_vote_updated', { sessionId: id });

    res.status(201).json(results);
  } catch (error) {
    console.error('Error adding dates:', error);
    res.status(500).json({ error: 'Failed to add dates' });
  }
});

// Vote for a date
router.post('/:id/dates/:dateId/vote', async (req: Request, res: Response) => {
  try {
    const { id, dateId } = req.params;
    const { participantId } = req.body;

    await query(
      'INSERT INTO date_votes (date_option_id, participant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [dateId, participantId]
    );

    const io: Server = req.app.get('io');
    io.to(id).emit('date_vote_updated', { sessionId: id, dateId, participantId });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error voting for date:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Remove date vote
router.delete('/:id/dates/:dateId/vote', async (req: Request, res: Response) => {
  try {
    const { id, dateId } = req.params;
    const { participantId } = req.body;

    await query(
      'DELETE FROM date_votes WHERE date_option_id = $1 AND participant_id = $2',
      [dateId, participantId]
    );

    const io: Server = req.app.get('io');
    io.to(id).emit('date_vote_updated', { sessionId: id, dateId, participantId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing date vote:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

// Add movie to session
router.post('/:id/movies', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tmdbId, title, posterPath, overview, releaseDate, voteAverage } = req.body;

    const result = await query<MovieOption>(
      `INSERT INTO movie_options (session_id, tmdb_id, title, poster_path, overview, release_date, vote_average)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (session_id, tmdb_id) DO NOTHING
       RETURNING *`,
      [id, tmdbId, title, posterPath, overview, releaseDate, voteAverage]
    );

    const io: Server = req.app.get('io');
    io.to(id).emit('movie_vote_updated', { sessionId: id });

    res.status(201).json(result.rows[0] || { message: 'Movie already added' });
  } catch (error) {
    console.error('Error adding movie:', error);
    res.status(500).json({ error: 'Failed to add movie' });
  }
});

// Vote for a movie
router.post('/:id/movies/:movieId/vote', async (req: Request, res: Response) => {
  try {
    const { id, movieId } = req.params;
    const { participantId } = req.body;

    await query(
      'INSERT INTO movie_votes (movie_option_id, participant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [movieId, participantId]
    );

    const io: Server = req.app.get('io');
    io.to(id).emit('movie_vote_updated', { sessionId: id, movieId, participantId });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error voting for movie:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Remove movie vote
router.delete('/:id/movies/:movieId/vote', async (req: Request, res: Response) => {
  try {
    const { id, movieId } = req.params;
    const { participantId } = req.body;

    await query(
      'DELETE FROM movie_votes WHERE movie_option_id = $1 AND participant_id = $2',
      [movieId, participantId]
    );

    const io: Server = req.app.get('io');
    io.to(id).emit('movie_vote_updated', { sessionId: id, movieId, participantId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing movie vote:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

// Submit ranked choice votes for movies
router.post('/:id/rankings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { participantId, rankings } = req.body;

    if (!Array.isArray(rankings) || rankings.length === 0) {
      return res.status(400).json({ error: 'Rankings array is required' });
    }

    // Delete existing rankings for this participant
    await query(
      'DELETE FROM movie_rankings WHERE session_id = $1 AND participant_id = $2',
      [id, participantId]
    );

    // Insert new rankings
    for (const movie of rankings) {
      await query(
        `INSERT INTO movie_rankings (session_id, participant_id, tmdb_id, title, poster_path, rank)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, participantId, movie.tmdbId, movie.title, movie.posterPath, movie.rank]
      );
    }

    const io: Server = req.app.get('io');
    io.to(id).emit('rankings_updated', { sessionId: id, participantId });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error submitting rankings:', error);
    res.status(500).json({ error: 'Failed to submit rankings' });
  }
});

// Get rankings for a session
router.get('/:id/rankings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rankingsResult = await query<{
      participant_id: string;
      tmdb_id: number;
      title: string;
      poster_path: string;
      rank: number;
    }>(
      `SELECT participant_id, tmdb_id, title, poster_path, rank
       FROM movie_rankings
       WHERE session_id = $1
       ORDER BY participant_id, rank`,
      [id]
    );

    // Group by participant
    const byParticipant: Record<string, Array<{tmdb_id: number; title: string; poster_path: string; rank: number}>> = {};
    for (const row of rankingsResult.rows) {
      if (!byParticipant[row.participant_id]) {
        byParticipant[row.participant_id] = [];
      }
      byParticipant[row.participant_id].push({
        tmdb_id: row.tmdb_id,
        title: row.title,
        poster_path: row.poster_path,
        rank: row.rank
      });
    }

    res.json(byParticipant);
  } catch (error) {
    console.error('Error getting rankings:', error);
    res.status(500).json({ error: 'Failed to get rankings' });
  }
});

// Calculate ranked choice winner
router.get('/:id/rankings/winner', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rankingsResult = await query<{
      participant_id: string;
      tmdb_id: number;
      title: string;
      poster_path: string;
      rank: number;
    }>(
      `SELECT participant_id, tmdb_id, title, poster_path, rank
       FROM movie_rankings
       WHERE session_id = $1
       ORDER BY participant_id, rank`,
      [id]
    );

    if (rankingsResult.rows.length === 0) {
      return res.json({ winner: null, rounds: [] });
    }

    // Group ballots by participant
    const ballots: Map<string, number[]> = new Map();
    const movieInfo: Map<number, { title: string; poster_path: string }> = new Map();

    for (const row of rankingsResult.rows) {
      if (!ballots.has(row.participant_id)) {
        ballots.set(row.participant_id, []);
      }
      ballots.get(row.participant_id)!.push(row.tmdb_id);
      movieInfo.set(row.tmdb_id, { title: row.title, poster_path: row.poster_path });
    }

    // Instant runoff voting
    const rounds: Array<{ counts: Record<number, number>; eliminated?: number }> = [];
    let remainingCandidates = new Set(movieInfo.keys());

    while (remainingCandidates.size > 1) {
      // Count first-choice votes
      const counts: Record<number, number> = {};
      for (const candidate of remainingCandidates) {
        counts[candidate] = 0;
      }

      for (const ballot of ballots.values()) {
        // Find first remaining candidate on this ballot
        for (const choice of ballot) {
          if (remainingCandidates.has(choice)) {
            counts[choice]++;
            break;
          }
        }
      }

      const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);

      // Check for majority winner
      for (const [candidate, count] of Object.entries(counts)) {
        if (count > totalVotes / 2) {
          rounds.push({ counts });
          const winnerId = parseInt(candidate);
          return res.json({
            winner: {
              tmdb_id: winnerId,
              ...movieInfo.get(winnerId)
            },
            rounds
          });
        }
      }

      // Eliminate candidate with fewest votes
      let minVotes = Infinity;
      let toEliminate = 0;
      for (const [candidate, count] of Object.entries(counts)) {
        if (count < minVotes) {
          minVotes = count;
          toEliminate = parseInt(candidate);
        }
      }

      rounds.push({ counts, eliminated: toEliminate });
      remainingCandidates.delete(toEliminate);
    }

    // Last remaining candidate wins
    const winnerId = [...remainingCandidates][0];
    res.json({
      winner: winnerId ? {
        tmdb_id: winnerId,
        ...movieInfo.get(winnerId)
      } : null,
      rounds
    });
  } catch (error) {
    console.error('Error calculating winner:', error);
    res.status(500).json({ error: 'Failed to calculate winner' });
  }
});

// Vote for a showtime
router.post('/:id/showtimes/vote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { participantId, theaterName, showtime, format } = req.body;

    if (!participantId || !theaterName || !showtime) {
      return res.status(400).json({ error: 'participantId, theaterName, and showtime are required' });
    }

    // Upsert the vote (one vote per participant)
    await query(
      `INSERT INTO showtime_votes (session_id, participant_id, theater_name, showtime, format)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id, participant_id)
       DO UPDATE SET theater_name = $3, showtime = $4, format = $5, created_at = NOW()`,
      [id, participantId, theaterName, showtime, format || 'Standard']
    );

    const io: Server = req.app.get('io');
    io.to(id).emit('showtime_vote_updated', { sessionId: id, participantId });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error voting for showtime:', error);
    res.status(500).json({ error: 'Failed to vote for showtime' });
  }
});

// Get all showtime votes for a session
router.get('/:id/showtimes/votes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const votesResult = await query<{
      participant_id: string;
      theater_name: string;
      showtime: string;
      format: string;
    }>(
      `SELECT sv.participant_id, sv.theater_name, sv.showtime, sv.format, p.name as participant_name
       FROM showtime_votes sv
       JOIN participants p ON sv.participant_id = p.id
       WHERE sv.session_id = $1`,
      [id]
    );

    // Group votes by theater+showtime to count
    const voteCounts: Record<string, { theaterName: string; showtime: string; format: string; count: number; voters: string[] }> = {};

    for (const vote of votesResult.rows) {
      const key = `${vote.theater_name}|${vote.showtime}|${vote.format}`;
      if (!voteCounts[key]) {
        voteCounts[key] = {
          theaterName: vote.theater_name,
          showtime: vote.showtime,
          format: vote.format,
          count: 0,
          voters: []
        };
      }
      voteCounts[key].count++;
      voteCounts[key].voters.push((vote as any).participant_name);
    }

    // Find the winner (most votes)
    let winner = null;
    let maxVotes = 0;
    for (const entry of Object.values(voteCounts)) {
      if (entry.count > maxVotes) {
        maxVotes = entry.count;
        winner = entry;
      }
    }

    res.json({
      votes: votesResult.rows,
      voteCounts: Object.values(voteCounts),
      winner
    });
  } catch (error) {
    console.error('Error getting showtime votes:', error);
    res.status(500).json({ error: 'Failed to get showtime votes' });
  }
});

// Remove showtime vote
router.delete('/:id/showtimes/vote', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { participantId } = req.body;

    await query(
      'DELETE FROM showtime_votes WHERE session_id = $1 AND participant_id = $2',
      [id, participantId]
    );

    const io: Server = req.app.get('io');
    io.to(id).emit('showtime_vote_updated', { sessionId: id, participantId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing showtime vote:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

export default router;
