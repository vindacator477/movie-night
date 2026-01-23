import { useState } from 'react';
import { Session, Participant, TMDbMovie } from '../types';
import { useSession } from '../hooks/useSession';
import { useNowPlaying, useMovieSearch } from '../hooks/useMovies';
import Card from './ui/Card';
import Button from './ui/Button';

interface Props {
  session: Session;
  participant: Participant;
}

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

export default function MovieVoting({ session, participant }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'now-playing' | 'search' | 'session'>('session');

  const { addMovie, voteForMovie, removeVoteForMovie } = useSession(session.id);
  const { data: nowPlaying, isLoading: nowPlayingLoading } = useNowPlaying();
  const { data: searchResults, isLoading: searchLoading } = useMovieSearch(searchQuery);

  const handleAddMovie = async (movie: TMDbMovie) => {
    await addMovie({
      tmdbId: movie.id,
      title: movie.title,
      posterPath: movie.poster_path,
      overview: movie.overview,
      releaseDate: movie.release_date,
      voteAverage: movie.vote_average,
    });
  };

  const handleVote = async (movieId: string, hasVoted: boolean) => {
    if (hasVoted) {
      await removeVoteForMovie({ movieId, participantId: participant.id });
    } else {
      await voteForMovie({ movieId, participantId: participant.id });
    }
  };

  const isMovieAdded = (tmdbId: number) =>
    session.movieOptions.some(m => m.tmdb_id === tmdbId);

  const renderMovieCard = (movie: TMDbMovie, isInSession: boolean = false) => {
    const added = isMovieAdded(movie.id);
    const sessionMovie = session.movieOptions.find(m => m.tmdb_id === movie.id);
    const votes = sessionMovie?.votes || [];
    const hasVoted = Array.isArray(votes) && votes.includes(participant.id);
    const voteCount = Array.isArray(votes) ? votes.length : 0;

    return (
      <div
        key={movie.id}
        className={`bg-gray-800 rounded-lg overflow-hidden ${
          isInSession && hasVoted ? 'ring-2 ring-cinema-accent' : ''
        }`}
      >
        <div className="aspect-[2/3] relative">
          {movie.poster_path ? (
            <img
              src={`${POSTER_BASE}${movie.poster_path}`}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500">
              No Image
            </div>
          )}

          {/* Rating badge */}
          <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-sm">
            ⭐ {movie.vote_average?.toFixed(1) || 'N/A'}
          </div>
        </div>

        <div className="p-3">
          <h4 className="font-medium text-sm line-clamp-2 mb-2">{movie.title}</h4>

          {movie.release_date && (
            <p className="text-xs text-gray-400 mb-2">
              {new Date(movie.release_date).getFullYear()}
            </p>
          )}

          {isInSession && sessionMovie ? (
            <div className="space-y-2">
              <Button
                onClick={() => handleVote(sessionMovie.id, hasVoted)}
                variant={hasVoted ? 'primary' : 'secondary'}
                size="sm"
                className="w-full"
              >
                {hasVoted ? '✓ Voted' : 'Vote'}
              </Button>
              <p className="text-xs text-center text-gray-400">
                {voteCount} vote{voteCount !== 1 ? 's' : ''}
              </p>
            </div>
          ) : (
            <Button
              onClick={() => handleAddMovie(movie)}
              disabled={added}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {added ? 'Added' : 'Add to Session'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Vote on Movies</h3>

      {session.selected_date && (
        <p className="text-gray-400 mb-4">
          Selected date:{' '}
          <span className="text-cinema-accent">
            {(() => {
              const normalizedDate = session.selected_date.includes('T')
                ? session.selected_date.split('T')[0]
                : session.selected_date;
              return new Date(normalizedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              });
            })()}
          </span>
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('session')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'session'
              ? 'text-cinema-accent border-b-2 border-cinema-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Session Movies ({session.movieOptions.length})
        </button>
        <button
          onClick={() => setActiveTab('now-playing')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'now-playing'
              ? 'text-cinema-accent border-b-2 border-cinema-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Now Playing
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'search'
              ? 'text-cinema-accent border-b-2 border-cinema-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Search
        </button>
      </div>

      {/* Session Movies Tab */}
      {activeTab === 'session' && (
        <div>
          {session.movieOptions.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {session.movieOptions
                .sort((a, b) => {
                  const aVotes = Array.isArray(a.votes) ? a.votes.length : 0;
                  const bVotes = Array.isArray(b.votes) ? b.votes.length : 0;
                  return bVotes - aVotes;
                })
                .map(movie =>
                  renderMovieCard(
                    {
                      id: movie.tmdb_id,
                      title: movie.title,
                      poster_path: movie.poster_path,
                      overview: movie.overview || '',
                      release_date: movie.release_date || '',
                      vote_average: movie.vote_average || 0,
                      backdrop_path: null,
                    },
                    true
                  )
                )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No movies added yet. Browse "Now Playing" or search to add movies!
            </div>
          )}
        </div>
      )}

      {/* Now Playing Tab */}
      {activeTab === 'now-playing' && (
        <div>
          {nowPlayingLoading ? (
            <div className="text-center py-8 text-gray-400">Loading movies...</div>
          ) : nowPlaying?.results ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {nowPlaying.results.map(movie => renderMovieCard(movie))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Unable to load movies. Please try again later.
            </div>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div>
          <div className="mb-6">
            <input
              type="text"
              className="input"
              placeholder="Search for a movie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {searchLoading ? (
            <div className="text-center py-8 text-gray-400">Searching...</div>
          ) : searchResults?.results && searchResults.results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {searchResults.results.map(movie => renderMovieCard(movie))}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="text-center py-8 text-gray-400">
              No movies found for "{searchQuery}"
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Enter at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
