import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Session, Participant, TMDbMovie } from '../types';
import { useNowPlaying } from '../hooks/useMovies';
import * as api from '../api/client';
import Card from './ui/Card';
import Button from './ui/Button';

interface Props {
  session: Session;
  participant: Participant;
}

interface RankedMovie {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  rank: number;
}

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';
const MAX_PICKS = 5;

export default function RankedMovieVoting({ session, participant }: Props) {
  const [myPicks, setMyPicks] = useState<RankedMovie[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const { data: nowPlaying, isLoading: nowPlayingLoading } = useNowPlaying();

  const { data: allRankings } = useQuery({
    queryKey: ['rankings', session.id],
    queryFn: () => api.getRankings(session.id),
    refetchInterval: 5000,
  });

  const { data: winnerData } = useQuery({
    queryKey: ['rankings-winner', session.id],
    queryFn: () => api.getRankingsWinner(session.id),
    refetchInterval: 5000,
  });

  const submitMutation = useMutation({
    mutationFn: () => api.submitRankings(session.id, participant.id, myPicks),
    onSuccess: () => {
      setHasSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['rankings', session.id] });
      queryClient.invalidateQueries({ queryKey: ['rankings-winner', session.id] });
    },
  });

  const handleSelectMovie = (movie: TMDbMovie) => {
    if (myPicks.some(p => p.tmdbId === movie.id)) {
      // Remove from picks
      const newPicks = myPicks.filter(p => p.tmdbId !== movie.id);
      // Re-rank remaining picks
      setMyPicks(newPicks.map((p, i) => ({ ...p, rank: i + 1 })));
    } else if (myPicks.length < MAX_PICKS) {
      // Add to picks
      setMyPicks([...myPicks, {
        tmdbId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        rank: myPicks.length + 1,
      }]);
    }
  };

  const handleSubmit = () => {
    if (myPicks.length > 0) {
      submitMutation.mutate();
    }
  };

  const getPickNumber = (tmdbId: number): number | null => {
    const pick = myPicks.find(p => p.tmdbId === tmdbId);
    return pick ? pick.rank : null;
  };

  // Check if current user already submitted
  const myExistingRankings = allRankings?.[participant.id];
  const participantsWhoVoted = allRankings ? Object.keys(allRankings).length : 0;

  if (nowPlayingLoading) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-400">Loading movies...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Your Picks */}
      <Card>
        <h3 className="text-xl font-bold mb-4">Your Top {MAX_PICKS} Picks</h3>
        <p className="text-gray-400 mb-4">
          Click movies below to rank them. Your #1 pick gets the most points.
        </p>

        {myPicks.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {myPicks.map((pick) => (
              <div key={pick.tmdbId} className="flex-shrink-0 text-center">
                <div className="relative">
                  <div className="absolute -top-2 -left-2 w-6 h-6 bg-cinema-accent rounded-full flex items-center justify-center text-sm font-bold z-10">
                    {pick.rank}
                  </div>
                  {pick.posterPath ? (
                    <img
                      src={`${POSTER_BASE}${pick.posterPath}`}
                      alt={pick.title}
                      className="w-20 h-30 object-cover rounded"
                    />
                  ) : (
                    <div className="w-20 h-30 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-500">
                      No Image
                    </div>
                  )}
                </div>
                <p className="text-xs mt-1 w-20 truncate">{pick.title}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            Select movies from below to rank them
          </p>
        )}

        {!hasSubmitted && !myExistingRankings && myPicks.length > 0 && (
          <Button
            onClick={handleSubmit}
            variant="primary"
            className="w-full mt-4"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Submitting...' : `Submit My ${myPicks.length} Pick${myPicks.length !== 1 ? 's' : ''}`}
          </Button>
        )}

        {(hasSubmitted || myExistingRankings) && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-center">
            <p className="text-green-400">Your votes have been submitted!</p>
          </div>
        )}
      </Card>

      {/* Voting Status */}
      <Card>
        <h4 className="font-bold mb-2">Voting Status</h4>
        <p className="text-gray-400">
          {participantsWhoVoted} of {session.participants.length} participants have voted
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {session.participants.map(p => {
            const hasVoted = allRankings?.[p.id];
            return (
              <span
                key={p.id}
                className={`px-2 py-1 rounded text-sm ${
                  hasVoted ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {p.name} {hasVoted ? '✓' : ''}
              </span>
            );
          })}
        </div>
      </Card>

      {/* Current Winner */}
      {winnerData?.winner && participantsWhoVoted > 0 && (
        <Card className="border-cinema-accent">
          <h4 className="font-bold mb-2 text-cinema-accent">Current Leader</h4>
          <div className="flex items-center gap-4">
            {winnerData.winner.poster_path && (
              <img
                src={`${POSTER_BASE}${winnerData.winner.poster_path}`}
                alt={winnerData.winner.title}
                className="w-16 rounded"
              />
            )}
            <div>
              <p className="text-xl font-bold">{winnerData.winner.title}</p>
              <p className="text-gray-400 text-sm">
                Winning by ranked choice voting
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Now Playing Movies */}
      <Card>
        <h4 className="font-bold mb-4">Now Playing - Click to Add to Your Picks</h4>
        {nowPlaying?.results ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {nowPlaying.results.map((movie) => {
              const pickNumber = getPickNumber(movie.id);
              const isSelected = pickNumber !== null;
              const canSelect = !isSelected && myPicks.length < MAX_PICKS;
              const isDisabled = !isSelected && !canSelect && !hasSubmitted && !myExistingRankings;

              return (
                <div
                  key={movie.id}
                  onClick={() => !hasSubmitted && !myExistingRankings && handleSelectMovie(movie)}
                  className={`relative cursor-pointer transition-all rounded-lg overflow-hidden ${
                    isSelected
                      ? 'ring-2 ring-cinema-accent scale-105'
                      : isDisabled
                      ? 'opacity-50'
                      : 'hover:scale-105'
                  } ${hasSubmitted || myExistingRankings ? 'cursor-default' : ''}`}
                >
                  {isSelected && (
                    <div className="absolute top-1 left-1 w-6 h-6 bg-cinema-accent rounded-full flex items-center justify-center text-sm font-bold z-10">
                      {pickNumber}
                    </div>
                  )}
                  {movie.poster_path ? (
                    <img
                      src={`${POSTER_BASE}${movie.poster_path}`}
                      alt={movie.title}
                      className="w-full aspect-[2/3] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                      No Image
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs font-medium truncate">{movie.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            Unable to load movies. Please try again later.
          </div>
        )}
      </Card>
    </div>
  );
}
