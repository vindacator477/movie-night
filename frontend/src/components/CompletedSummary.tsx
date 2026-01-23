import { useQuery } from '@tanstack/react-query';
import { Session } from '../types';
import * as api from '../api/client';
import Card from './ui/Card';

interface Props {
  session: Session;
}

export default function CompletedSummary({ session }: Props) {
  // Get winning movie from ranked choice voting
  const { data: winnerData } = useQuery({
    queryKey: ['rankings-winner', session.id],
    queryFn: () => api.getRankingsWinner(session.id),
  });

  // Get showtime votes
  const { data: showtimeVotes } = useQuery({
    queryKey: ['showtime-votes', session.id],
    queryFn: () => api.getShowtimeVotes(session.id),
  });

  const selectedMovie = winnerData?.winner;
  const winningShowtime = showtimeVotes?.winner;

  // Format the selected date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not selected';
    const normalized = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return new Date(normalized + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="text-center bg-gradient-to-r from-cinema-accent/20 to-green-500/20 border border-cinema-accent/30">
        <h2 className="text-2xl font-bold text-cinema-accent mb-2">Movie Night Planned!</h2>
        <p className="text-gray-300">Here's the summary of your group's choices</p>
      </Card>

      {/* Movie Winner */}
      <Card>
        <h3 className="text-lg font-bold mb-4 text-cinema-accent">Winning Movie</h3>
        {selectedMovie ? (
          <div className="flex gap-4">
            {selectedMovie.poster_path && (
              <img
                src={`https://image.tmdb.org/t/p/w185${selectedMovie.poster_path}`}
                alt={selectedMovie.title}
                className="w-24 rounded-lg"
              />
            )}
            <div>
              <h4 className="text-xl font-bold">{selectedMovie.title}</h4>
              {winnerData?.rounds && winnerData.rounds.length > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  Won after {winnerData.rounds.length} round{winnerData.rounds.length !== 1 ? 's' : ''} of ranked choice voting
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No movie was selected</p>
        )}
      </Card>

      {/* Selected Date */}
      <Card>
        <h3 className="text-lg font-bold mb-4 text-cinema-accent">Selected Date</h3>
        <div className="flex items-center gap-3">
          <div className="text-3xl">📅</div>
          <div>
            <p className="text-xl font-medium">{formatDate(session.selected_date)}</p>
          </div>
        </div>
      </Card>

      {/* Winning Showtime */}
      <Card className={winningShowtime ? 'bg-green-900/20 border border-green-500/30' : ''}>
        <h3 className="text-lg font-bold mb-4 text-cinema-accent">Winning Showtime</h3>
        {winningShowtime ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🎬</div>
              <div>
                <p className="text-xl font-bold">{winningShowtime.theaterName}</p>
                <p className="text-2xl font-bold text-green-400">{winningShowtime.showtime}</p>
                {winningShowtime.format !== 'Standard' && (
                  <span className="inline-block mt-1 text-sm bg-cinema-accent/20 text-cinema-accent px-2 py-0.5 rounded">
                    {winningShowtime.format}
                  </span>
                )}
              </div>
            </div>
            <div className="border-t border-gray-700 pt-3 mt-3">
              <p className="text-sm text-gray-400">
                <span className="font-medium text-green-400">{winningShowtime.count}</span> vote{winningShowtime.count !== 1 ? 's' : ''}
                {winningShowtime.voters.length > 0 && (
                  <span> from: {winningShowtime.voters.join(', ')}</span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No showtime votes were cast</p>
        )}
      </Card>

      {/* All Showtime Votes */}
      {showtimeVotes && showtimeVotes.voteCounts.length > 1 && (
        <Card>
          <h3 className="text-lg font-bold mb-4 text-cinema-accent">All Showtime Votes</h3>
          <div className="space-y-2">
            {showtimeVotes.voteCounts
              .sort((a, b) => b.count - a.count)
              .map((vote, idx) => (
                <div
                  key={idx}
                  className={`flex justify-between items-center p-3 rounded ${
                    idx === 0 ? 'bg-green-600/20 border border-green-500/30' : 'bg-gray-700/50'
                  }`}
                >
                  <div>
                    <span className="font-medium">{vote.theaterName}</span>
                    <span className="text-gray-400 mx-2">@</span>
                    <span className="text-cinema-accent font-bold">{vote.showtime}</span>
                    {vote.format !== 'Standard' && (
                      <span className="ml-2 text-xs bg-gray-600 px-1.5 py-0.5 rounded">{vote.format}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg">{vote.count}</span>
                    <span className="text-gray-400 text-sm ml-1">vote{vote.count !== 1 ? 's' : ''}</span>
                    <div className="text-xs text-gray-500">{vote.voters.join(', ')}</div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Quick Summary Card */}
      <Card className="bg-gray-800/80">
        <h3 className="text-lg font-bold mb-4 text-center">Quick Summary</h3>
        <div className="text-center space-y-2">
          <p className="text-xl">
            <span className="text-cinema-accent font-bold">{selectedMovie?.title || 'Movie TBD'}</span>
          </p>
          <p className="text-gray-300">
            {formatDate(session.selected_date)}
          </p>
          {winningShowtime && (
            <p className="text-green-400 font-bold text-lg">
              {winningShowtime.showtime} at {winningShowtime.theaterName}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
