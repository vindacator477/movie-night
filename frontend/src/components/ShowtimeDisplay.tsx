import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Session } from '../types';
import { useTheaters, useShowtimes } from '../hooks/useMovies';
import * as api from '../api/client';
import Card from './ui/Card';
import Button from './ui/Button';

interface Props {
  session: Session;
  participantId: string | null;
}

export default function ShowtimeDisplay({ session, participantId }: Props) {
  const [selectedChain, setSelectedChain] = useState<string | undefined>();
  const queryClient = useQueryClient();

  // Get winning movie from ranked choice voting
  const { data: winnerData } = useQuery({
    queryKey: ['rankings-winner', session.id],
    queryFn: () => api.getRankingsWinner(session.id),
  });

  const selectedMovie = winnerData?.winner;

  // Get showtime votes
  const { data: voteData } = useQuery({
    queryKey: ['showtime-votes', session.id],
    queryFn: () => api.getShowtimeVotes(session.id),
    refetchInterval: 5000,
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: (params: { theaterName: string; showtime: string; format: string }) =>
      api.voteForShowtime(session.id, participantId!, params.theaterName, params.showtime, params.format),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showtime-votes', session.id] });
    },
  });

  // Check if user has already voted
  const myVote = voteData?.votes.find(v => v.participant_id === participantId);

  const handleShowtimeClick = (theaterName: string, showtime: string, format: string) => {
    if (!participantId) return;
    voteMutation.mutate({ theaterName, showtime, format });
  };

  // Helper to check if this showtime is selected by user
  const isSelected = (theaterName: string, showtime: string, format: string) => {
    return myVote?.theater_name === theaterName && myVote?.showtime === showtime && myVote?.format === format;
  };

  // Helper to get vote count for a showtime
  const getVoteCount = (theaterName: string, showtime: string, format: string) => {
    const entry = voteData?.voteCounts.find(
      v => v.theaterName === theaterName && v.showtime === showtime && v.format === format
    );
    return entry?.count || 0;
  };

  // Helper to get voters for a showtime
  const getVoters = (theaterName: string, showtime: string, format: string) => {
    const entry = voteData?.voteCounts.find(
      v => v.theaterName === theaterName && v.showtime === showtime && v.format === format
    );
    return entry?.voters || [];
  };

  const { data: theaters } = useTheaters(
    session.location_zip || undefined,
    session.location_city || undefined
  );

  const { data: showtimes, isLoading, error } = useShowtimes(
    selectedMovie && session.selected_date
      ? {
          movie: selectedMovie.title,
          date: session.selected_date,
          zip: session.location_zip || undefined,
          chain: selectedChain,
        }
      : null
  );

  if (!selectedMovie || !session.selected_date) {
    return (
      <Card className="text-center">
        <p className="text-gray-400">No movie or date selected.</p>
      </Card>
    );
  }

  // Normalize date string - extract YYYY-MM-DD if it's a full ISO datetime
  const normalizedDate = session.selected_date.includes('T')
    ? session.selected_date.split('T')[0]
    : session.selected_date;
  const formattedDate = new Date(normalizedDate + 'T00:00:00').toLocaleDateString(
    'en-US',
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }
  );

  return (
    <div className="space-y-6">
      {/* Selection Summary */}
      <Card>
        <h3 className="text-xl font-bold mb-4">Showtimes</h3>

        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          {selectedMovie.poster_path && (
            <img
              src={`https://image.tmdb.org/t/p/w185${selectedMovie.poster_path}`}
              alt={selectedMovie.title}
              className="w-24 rounded-lg"
            />
          )}
          <div>
            <h4 className="text-lg font-bold text-cinema-accent">
              {selectedMovie.title}
            </h4>
            <p className="text-gray-400">{formattedDate}</p>
            {(session.location_city || session.location_zip) && (
              <p className="text-gray-400 text-sm">
                Near {session.location_city || `ZIP ${session.location_zip}`}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Voting Summary */}
      {voteData && voteData.voteCounts.length > 0 && (
        <Card className="bg-gray-800/50 border border-cinema-accent/30">
          <h4 className="font-bold mb-3 flex items-center gap-2">
            <span className="text-cinema-accent">Showtime Votes</span>
            {voteData.winner && <span className="text-green-400 text-sm">(Winner highlighted in green)</span>}
          </h4>
          <div className="space-y-2">
            {voteData.voteCounts
              .sort((a, b) => b.count - a.count)
              .map((vote, idx) => (
                <div
                  key={idx}
                  className={`flex justify-between items-center p-2 rounded ${
                    idx === 0 ? 'bg-green-600/20 border border-green-500/30' : 'bg-gray-700/50'
                  }`}
                >
                  <div>
                    <span className="font-medium">{vote.theaterName}</span>
                    <span className="text-gray-400 mx-2">@</span>
                    <span className="text-cinema-accent">{vote.showtime}</span>
                    {vote.format !== 'Standard' && (
                      <span className="ml-2 text-xs bg-gray-600 px-1.5 py-0.5 rounded">{vote.format}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{vote.count}</span>
                    <span className="text-gray-400 text-sm ml-1">vote{vote.count !== 1 ? 's' : ''}</span>
                    <div className="text-xs text-gray-500">{vote.voters.join(', ')}</div>
                  </div>
                </div>
              ))}
          </div>
          {myVote && (
            <p className="mt-3 text-sm text-gray-400">
              Your vote: <span className="text-cinema-accent">{myVote.theater_name} @ {myVote.showtime}</span>
            </p>
          )}
          {!myVote && participantId && (
            <p className="mt-3 text-sm text-gray-400">
              Click on a showtime below to cast your vote!
            </p>
          )}
        </Card>
      )}

      {/* Voting prompt if no votes yet */}
      {voteData && voteData.voteCounts.length === 0 && participantId && (
        <Card className="bg-blue-900/20 border border-blue-500/30">
          <p className="text-center text-blue-300">
            Click on any showtime below to vote for your preferred time!
          </p>
        </Card>
      )}

      {/* Chain Filter */}
      <div className="flex gap-2">
        <Button
          onClick={() => setSelectedChain(undefined)}
          variant={!selectedChain ? 'primary' : 'secondary'}
          size="sm"
        >
          All Theaters
        </Button>
        <Button
          onClick={() => setSelectedChain('megaplex')}
          variant={selectedChain === 'megaplex' ? 'primary' : 'secondary'}
          size="sm"
        >
          Megaplex
        </Button>
        <Button
          onClick={() => setSelectedChain('cinemark')}
          variant={selectedChain === 'cinemark' ? 'primary' : 'secondary'}
          size="sm"
        >
          Cinemark
        </Button>
      </div>

      {/* Showtimes */}
      {isLoading ? (
        <Card>
          <div className="text-center py-8">
            <div className="animate-pulse text-gray-400">
              Searching for showtimes...
            </div>
            <p className="text-sm text-gray-500 mt-2">
              This may take a moment as we check theater websites.
            </p>
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="text-center py-8 text-red-400">
            <p>Unable to load showtimes. Please try again later.</p>
          </div>
        </Card>
      ) : showtimes && showtimes.length > 0 ? (
        <div className="space-y-4">
          {showtimes.map((theater, index) => (
            <Card key={index}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h4 className="font-bold">{theater.theaterName}</h4>
                  {theater.theaterAddress && (
                    <p className="text-sm text-gray-400">{theater.theaterAddress}</p>
                  )}
                </div>

                {theater.bookingUrl && (
                  <a
                    href={theater.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline text-sm"
                  >
                    Buy Tickets
                  </a>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {theater.times.map((showtime, idx) => {
                  const voteCount = getVoteCount(theater.theaterName, showtime.time, showtime.format);
                  const voters = getVoters(theater.theaterName, showtime.time, showtime.format);
                  const selected = isSelected(theater.theaterName, showtime.time, showtime.format);
                  const isWinner = voteData?.winner?.theaterName === theater.theaterName &&
                    voteData?.winner?.showtime === showtime.time &&
                    voteData?.winner?.format === showtime.format;

                  return (
                    <div
                      key={idx}
                      onClick={() => showtime.available && handleShowtimeClick(theater.theaterName, showtime.time, showtime.format)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        selected
                          ? 'bg-cinema-accent text-black ring-2 ring-white'
                          : isWinner
                          ? 'bg-green-600 hover:bg-green-500 cursor-pointer'
                          : showtime.available
                          ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                      title={voters.length > 0 ? `Votes: ${voters.join(', ')}` : 'Click to vote'}
                    >
                      <span className="font-medium">{showtime.time}</span>
                      {showtime.format !== 'Standard' && (
                        <span className="ml-1 text-xs text-cinema-accent">
                          {showtime.format}
                        </span>
                      )}
                      {voteCount > 0 && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${selected ? 'bg-black/20' : 'bg-cinema-accent/20 text-cinema-accent'}`}>
                          {voteCount} vote{voteCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {!showtime.available && (
                        <span className="ml-1 text-xs">(Sold Out)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-8 text-gray-400">
            <p>No showtimes found for this movie and date.</p>
            <p className="text-sm mt-2">
              The movie may not be showing at nearby theaters, or showtimes
              haven't been released yet.
            </p>
          </div>
        </Card>
      )}

      {/* Available Theaters Info */}
      {theaters && theaters.length > 0 && (
        <Card>
          <h4 className="font-medium mb-3">Theaters in your area:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {theaters.map((theater, index) => (
              <div key={index} className="text-sm">
                <p className="font-medium">{theater.name}</p>
                <p className="text-gray-400">{theater.address}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
