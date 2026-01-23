import { useState } from 'react';
import { Session } from '../types';
import { useTheaters, useShowtimes } from '../hooks/useMovies';
import Card from './ui/Card';
import Button from './ui/Button';

interface Props {
  session: Session;
}

export default function ShowtimeDisplay({ session }: Props) {
  const [selectedChain, setSelectedChain] = useState<string | undefined>();

  const selectedMovie = session.movieOptions.find(
    m => m.tmdb_id === session.selected_movie_id
  );

  const { data: theaters } = useTheaters(
    session.location_zip || undefined,
    session.location_city || undefined
  );

  const { data: showtimes, isLoading, error } = useShowtimes(
    selectedMovie && session.selected_date
      ? {
          movie: selectedMovie.title,
          date: session.selected_date,
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

  const formattedDate = new Date(session.selected_date + 'T00:00:00').toLocaleDateString(
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
                {theater.times.map((showtime, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      showtime.available
                        ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <span className="font-medium">{showtime.time}</span>
                    {showtime.format !== 'Standard' && (
                      <span className="ml-1 text-xs text-cinema-accent">
                        {showtime.format}
                      </span>
                    )}
                    {!showtime.available && (
                      <span className="ml-1 text-xs">(Sold Out)</span>
                    )}
                  </div>
                ))}
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
