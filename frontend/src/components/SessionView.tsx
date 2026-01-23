import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useSocket } from '../hooks/useSocket';
import { Participant } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import DateVoting from './DateVoting';
import MovieVoting from './MovieVoting';
import LocationInput from './LocationInput';
import ShowtimeDisplay from './ShowtimeDisplay';

const PARTICIPANT_KEY = 'movie-night-participant';

export default function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [joinName, setJoinName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const {
    session,
    isLoading,
    error,
    invalidateSession,
    joinSession,
    advanceSession,
  } = useSession(sessionId || null);

  // Socket connection for real-time updates
  const handleUpdate = useCallback(() => {
    invalidateSession();
  }, [invalidateSession]);

  useSocket(sessionId || null, handleUpdate);

  // Load participant from localStorage
  useEffect(() => {
    if (sessionId) {
      const stored = localStorage.getItem(`${PARTICIPANT_KEY}-${sessionId}`);
      if (stored) {
        try {
          setParticipant(JSON.parse(stored));
        } catch {
          localStorage.removeItem(`${PARTICIPANT_KEY}-${sessionId}`);
        }
      }
    }
  }, [sessionId]);

  // Verify participant is still valid
  useEffect(() => {
    if (session && participant) {
      const found = session.participants.find(p => p.id === participant.id);
      if (!found) {
        localStorage.removeItem(`${PARTICIPANT_KEY}-${sessionId}`);
        setParticipant(null);
      }
    }
  }, [session, participant, sessionId]);

  const handleJoin = async () => {
    if (!joinName.trim() || !sessionId) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      const newParticipant = await joinSession({ name: joinName.trim() });
      setParticipant(newParticipant);
      localStorage.setItem(
        `${PARTICIPANT_KEY}-${sessionId}`,
        JSON.stringify(newParticipant)
      );
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setIsJoining(false);
    }
  };

  const handleAdvance = async () => {
    if (!participant) return;
    try {
      await advanceSession(participant.id);
    } catch (err) {
      console.error('Failed to advance session:', err);
    }
  };

  const [copied, setCopied] = useState(false);

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = participant && session?.admin_participant_id === participant.id;

  // Debug logging
  console.log('Session admin check:', {
    participantId: participant?.id,
    adminId: session?.admin_participant_id,
    isAdmin,
    sessionStatus: session?.status
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading session...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <Card className="max-w-lg mx-auto text-center">
        <h2 className="text-xl font-bold text-red-400 mb-4">Session Not Found</h2>
        <p className="text-gray-400">
          This session may have expired or doesn't exist.
        </p>
      </Card>
    );
  }

  if (!participant) {
    return (
      <Card className="max-w-lg mx-auto">
        <h2 className="text-2xl font-bold mb-2">
          {session.name || 'Movie Night'}
        </h2>
        <p className="text-gray-400 mb-6">Enter your name to join this session</p>

        <div className="space-y-4">
          <input
            type="text"
            className="input"
            placeholder="Your name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            maxLength={50}
          />

          {joinError && (
            <div className="text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg">
              {joinError}
            </div>
          )}

          <Button
            onClick={handleJoin}
            disabled={isJoining || !joinName.trim()}
            className="w-full"
            variant="primary"
          >
            {isJoining ? 'Joining...' : 'Join Session'}
          </Button>
        </div>

        {session.participants.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-2">
              {session.participants.length} participant{session.participants.length !== 1 ? 's' : ''} already joined:
            </p>
            <div className="flex flex-wrap gap-2">
              {session.participants.map(p => (
                <span key={p.id} className="px-2 py-1 bg-gray-700 rounded text-sm">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  }

  const statusLabels: Record<string, string> = {
    voting_dates: 'Voting on Dates',
    voting_movies: 'Voting on Movies',
    selecting_location: 'Selecting Location',
    viewing_showtimes: 'Viewing Showtimes',
    completed: 'Completed',
  };

  return (
    <div className="space-y-6">
      {/* Share Banner */}
      <Card className="bg-gradient-to-r from-cinema-accent/20 to-purple-900/20 border-cinema-accent/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-300 mb-1">Share this session with your friends:</p>
            <div className="flex items-center gap-2">
              <code className="bg-gray-800 px-3 py-1 rounded text-lg font-mono text-cinema-accent">
                {sessionId}
              </code>
            </div>
          </div>
          <Button
            onClick={copyShareLink}
            variant="primary"
            className="whitespace-nowrap"
          >
            {copied ? '✓ Copied!' : 'Copy Invite Link'}
          </Button>
        </div>
      </Card>

      {/* Header */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{session.name || 'Movie Night'}</h2>
            <p className="text-gray-400">
              Status: <span className="text-cinema-accent">{statusLabels[session.status]}</span>
            </p>
          </div>

          {isAdmin && session.status !== 'completed' && (
            <Button onClick={handleAdvance} variant="secondary">
              Next Step →
            </Button>
          )}
        </div>

        {/* Participants */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 mb-2">
            Participants ({session.participants.length}/20):
          </p>
          <div className="flex flex-wrap gap-2">
            {session.participants.map(p => {
              const isParticipantAdmin = p.id === session.admin_participant_id;
              const isYou = p.id === participant.id;
              return (
                <span
                  key={p.id}
                  className={`px-2 py-1 rounded text-sm flex items-center gap-1 ${
                    isYou
                      ? 'bg-cinema-accent text-white'
                      : 'bg-gray-700'
                  }`}
                >
                  {isParticipantAdmin && <span title="Session Admin">👑</span>}
                  {p.name}
                  {isYou && ' (you)'}
                </span>
              );
            })}
          </div>
          {!isAdmin && (
            <p className="text-xs text-gray-500 mt-2">
              👑 = Session admin (can advance to next step)
            </p>
          )}
        </div>
      </Card>

      {/* Progress Steps */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-sm">
          {['voting_dates', 'voting_movies', 'selecting_location', 'viewing_showtimes'].map(
            (step, index, arr) => {
              const stepIndex = arr.indexOf(session.status);
              const isActive = step === session.status;
              const isComplete = arr.indexOf(step) < stepIndex;

              return (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-cinema-accent text-white'
                        : isComplete
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {isComplete ? '✓' : index + 1}
                  </div>
                  {index < arr.length - 1 && (
                    <div className={`w-8 h-0.5 ${isComplete ? 'bg-green-600' : 'bg-gray-700'}`} />
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Current Step Content */}
      {session.status === 'voting_dates' && (
        <DateVoting session={session} participant={participant} />
      )}

      {session.status === 'voting_movies' && (
        <MovieVoting session={session} participant={participant} />
      )}

      {session.status === 'selecting_location' && (
        <LocationInput session={session} />
      )}

      {session.status === 'viewing_showtimes' && (
        <ShowtimeDisplay session={session} />
      )}

      {session.status === 'completed' && (
        <Card className="text-center">
          <h3 className="text-xl font-bold mb-4">Movie Night Planned!</h3>
          <p className="text-gray-400">
            Your movie night has been coordinated. Check the showtimes above and enjoy!
          </p>
        </Card>
      )}
    </div>
  );
}
