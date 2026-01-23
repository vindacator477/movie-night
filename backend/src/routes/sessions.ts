import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { Session, Participant, DateOption, MovieOption, SessionStatus } from '../models/index.js';
import { Server } from 'socket.io';

const router = Router();

// Create new session
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const result = await query<Session>(
      'INSERT INTO sessions (name) VALUES ($1) RETURNING *',
      [name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
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

// Join session
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check session exists
    const sessionResult = await query<Session>(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check participant limit (max 20)
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM participants WHERE session_id = $1',
      [id]
    );

    if (parseInt(countResult.rows[0].count) >= 20) {
      return res.status(400).json({ error: 'Session is full (max 20 participants)' });
    }

    const result = await query<Participant>(
      'INSERT INTO participants (session_id, name) VALUES ($1, $2) RETURNING *',
      [id, name.trim()]
    );

    const newParticipant = result.rows[0];

    // If no admin set yet, make this participant the admin (first joiner)
    if (!sessionResult.rows[0].admin_participant_id) {
      await query(
        'UPDATE sessions SET admin_participant_id = $1 WHERE id = $2',
        [newParticipant.id, id]
      );
    }

    const io: Server = req.app.get('io');
    io.to(id).emit('participant_joined', newParticipant);

    res.status(201).json(newParticipant);
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

    // If advancing from voting_movies, set the winning movie
    if (session.status === 'voting_movies') {
      const winningMovie = await query<{ tmdb_id: number }>(
        `SELECT m.tmdb_id, COUNT(mv.id) as vote_count
         FROM movie_options m
         LEFT JOIN movie_votes mv ON m.id = mv.movie_option_id
         WHERE m.session_id = $1
         GROUP BY m.id, m.tmdb_id
         ORDER BY vote_count DESC, m.title ASC
         LIMIT 1`,
        [id]
      );

      if (winningMovie.rows.length > 0) {
        updateQuery += ', selected_movie_id = $3';
        params.push(winningMovie.rows[0].tmdb_id);
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

export default router;
