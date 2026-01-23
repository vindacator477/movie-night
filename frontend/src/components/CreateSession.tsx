import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../api/client';
import Button from './ui/Button';
import Card from './ui/Card';

export default function CreateSession() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await createSession(name || undefined);
      navigate(`/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <h2 className="text-2xl font-bold mb-6 text-center">
          Start a Movie Night
        </h2>

        <p className="text-gray-400 mb-6 text-center">
          Create a session to coordinate movie nights with friends. Share the
          link to invite others to vote on dates and movies.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="sessionName" className="block text-sm font-medium text-gray-300 mb-2">
              Session Name (optional)
            </label>
            <input
              id="sessionName"
              type="text"
              className="input"
              placeholder="e.g., Friday Night Movies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <Button
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full"
            variant="primary"
          >
            {isLoading ? 'Creating...' : 'Create Session'}
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-700">
          <h3 className="font-medium mb-4">How it works:</h3>
          <ol className="space-y-3 text-gray-400 text-sm">
            <li className="flex gap-3">
              <span className="text-cinema-accent font-bold">1.</span>
              Create a session and share the link with friends
            </li>
            <li className="flex gap-3">
              <span className="text-cinema-accent font-bold">2.</span>
              Vote on available dates
            </li>
            <li className="flex gap-3">
              <span className="text-cinema-accent font-bold">3.</span>
              Browse and vote on movies
            </li>
            <li className="flex gap-3">
              <span className="text-cinema-accent font-bold">4.</span>
              Find showtimes at Utah theaters
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
