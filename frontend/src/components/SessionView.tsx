import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useSocket } from '../hooks/useSocket';
import { Participant, Session } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import DateVoting from './DateVoting';
import RankedMovieVoting from './RankedMovieVoting';
import LocationInput from './LocationInput';
import ShowtimeDisplay from './ShowtimeDisplay';
import CompletedSummary from './CompletedSummary';
import { getSessionByCode } from '../api/client';

const PARTICIPANT_KEY = 'movie-night-participant';

export default function SessionView() {
  const { sessionId, roomCode } = useParams<{ sessionId?: string; roomCode?: string }>();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [joinName, setJoinName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null);

  const {
    session,
    isLoading,
    error,
    invalidateSession,
    joinSession,
    advanceSession,
    goBackSession,
  } = useSession(resolvedSessionId || undefined);

  // Socket connection for real-time updates
  const handleUpdate = useCallback(() => {
    invalidateSession();
  }, [invalidateSession]);

  useSocket(resolvedSessionId || null, handleUpdate);

  // Load participant from localStorage
  useEffect(() => {
    if (resolvedSessionId) {
      const stored = localStorage.getItem(`${PARTICIPANT_KEY}-${resolvedSessionId}`);
      if (stored) {
        try {
          setParticipant(JSON.parse(stored));
        } catch {
          localStorage.removeItem(`${PARTICIPANT_KEY}-${resolvedSessionId}`);
        }
      }
    }
  }, [resolvedSessionId]);

  // Resolve room code to session ID
  useEffect(() => {
    const resolveSession = async () => {
      if (roomCode && !sessionId) {
        try {
          const sess = await getSessionByCode(roomCode);
          setResolvedSessionId(sess.id);
        } catch (err) {
          console.error('Failed to resolve room code:', err);
        }
      } else if (sessionId) {
        setResolvedSessionId(sessionId);
      }
    };

    resolveSession();
  }, [sessionId, roomCode]);

  // Verify participant is still valid
  const [hasJoinedThisSession, setHasJoinedThisSession] = useState(false);

  useEffect(() => {
    if (hasJoinedThisSession) return;

    if (session && participant) {
      const found = session.participants?.find(p => p.id === participant.id);
      if (!found) {
        localStorage.removeItem(`${PARTICIPANT_KEY}-${resolvedSessionId}`);
        setParticipant(null);
      }
    }
  }, [session, participant, resolvedSessionId, hasJoinedThisSession]);

  const handleJoin = async () => {
    if (!joinName.trim() || !resolvedSessionId) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      const result = await joinSession({ name: joinName.trim() });
      setHasJoinedThisSession(true);
      setParticipant(result.participant);
      localStorage.setItem(
        `${PARTICIPANT_KEY}-${resolvedSessionId}`,
        JSON.stringify(result.participant)
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

  const handleGoBack = async () => {
    if (!participant) return;
    try {
      await goBackSession(participant.id);
    } catch (err) {
      console.error('Failed to go back:', err);
    }
  };

  const [copied, setCopied] = useState(false);

  const copyShareLink = () => {
    const baseUrl = window.location.origin;
    const shareUrl = session?.room_code
      ? `${baseUrl}/join/${session.room_code}`
      : window.location.href;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = participant && session?.admin_participant_id === participant.id;

  // Loading states
  if (isLoading || (!session && !error && !roomCode && !resolvedSessionId)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading session...</div>
      </div>
    );
  }

  // Show loading while resolving room code
  if (!resolvedSessionId && roomCode) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Joining session...</div>
      </div>
    );
  }

  // Session not found
  if (error || (!session && resolvedSessionId)) {
    return (
      <Card className="max-w-lg mx-auto text-center">
        <h2 className="text-xl font-bold text-red-400 mb-4">Session Not Found</h2>
        <p className="text-gray-400">
          This session may have expired or doesn't exist.
        </p>
      </Card>
    );
  }

  // Still loading session data
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading session...</div>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    voting_dates: 'Voting on Dates',
    voting_movies: 'Voting on Movies',
    selecting_location: 'Selecting Location',
    viewing_showtimes: 'Viewing Showtimes',
    completed: 'Completed',
  };

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

        {session.participants && session.participants.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-2">
              {session.participants.length} participant{session.participants.length !== 1 ? 's' : ''} already joined:
            </p>
            <div className="flex flex-wrap gap-2">
              {session.participants.map((p: Participant) => (
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

  return (
    <div className="space-y-6">
      {/* Share Banner */}
      <Card className="bg-gradient-to-r from-cinema-accent/20 to-purple-900/20 border-cinema-accent/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-300 mb-1">Share with friends:</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Room Code:</span>
              <code className="bg-gray-800 px-3 py-1 rounded text-lg font-mono text-cinema-accent">
                {session.room_code || '???? '}
              </code>
            </div>
            <p className="text-xs text-gray-500 mt-1">or share invite link:</p>
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

          {session.status !== 'completed' && (
            <div className="flex gap-2">
              {session.status !== 'voting_dates' && (
                <Button
                  onClick={handleGoBack}
                  variant="outline"
                  disabled={!isAdmin}
                  title={isAdmin ? 'Go back to previous step' : 'Only the admin can go back'}
                >
                  ← Back
                </Button>
              )}
              <Button
                onClick={handleAdvance}
                variant="secondary"
                disabled={!isAdmin}
                title={isAdmin ? 'Advance to next step' : 'Only the admin can advance'}
              >
                {isAdmin ? 'Next Step →' : 'Next Step (Admin)'}
              </Button>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 mb-2">
            Participants ({session.participants?.length || 0}/20):
          </p>
          <div className="flex flex-wrap gap-2">
            {session.participants?.map((p: Participant) => {
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
        <RankedMovieVoting session={session} participant={participant} />
      )}

      {session.status === 'selecting_location' && (
        <LocationInput session={session} participant={participant} onAdvance={handleAdvance} />
      )}

      {session.status === 'viewing_showtimes' && (
        <ShowtimeDisplay session={session} participantId={participant?.id || null} />
      )}

      {session.status === 'completed' && (
        <CompletedSummary session={session} />
      )}
    </div>
  );
}
