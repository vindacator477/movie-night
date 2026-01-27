import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinSession } from '../api/client';
import Button from './ui/Button';
import Card from './ui/Card';

export default function CreateSession() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleStartSession = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await joinSession(undefined, undefined, name);
      navigate(`/session/${result.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSession = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await joinSession(undefined, roomCode.toUpperCase(), name || 'Guest');
      navigate(`/session/${result.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <h2 className="text-2xl font-bold mb-6 text-center">
          🎬 Movie Night
        </h2>

        <p className="text-gray-400 mb-6 text-center">
          Coordinate movie nights with friends. Vote on dates, movies, and showtimes together.
        </p>

        <div className="space-y-6">
          {/* Name input - always show */}
          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <input
              id="userName"
              type="text"
              className="input"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Start new session */}
          <div>
            <Button
              onClick={handleStartSession}
              disabled={isLoading || !name.trim()}
              className="w-full"
              variant="primary"
            >
              {isLoading ? 'Starting...' : '✨ Start Movie Night'}
            </Button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Creates a new session - you become the admin
            </p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-500">or join existing</span>
            </div>
          </div>

          {/* Join existing session */}
          <div>
            <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300 mb-2">
              Room Code
            </label>
            <div className="flex gap-2">
              <input
                id="roomCode"
                type="text"
                className="input flex-1 uppercase"
                placeholder="e.g., M8X2"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={4}
              />
              <Button
                onClick={handleJoinSession}
                disabled={isLoading || !roomCode.trim()}
                variant="secondary"
              >
                Join
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-700">
          <h3 className="font-medium mb-4">How it works:</h3>
          <ol className="space-y-3 text-gray-400 text-sm">
            <li className="flex gap-3">
              <span className="text-cinema-accent font-bold">1.</span>
              Start a session and share the room code
            </li>
            <li className="flex gap-3">
              <span className="text-cinema-accent font-bold">2.</span>
              Vote on movies together
            </li>
            <li className="flex gap-3">
              <span className="text-cinema-accent font-bold">3.</span>
              Find showtimes at nearby theaters
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
