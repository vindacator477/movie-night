import { useState, useEffect } from 'react';
import { Session, Participant } from '../types';
import { useSession } from '../hooks/useSession';
import { useTheaters } from '../hooks/useMovies';
import Card from './ui/Card';
import Button from './ui/Button';

interface Props {
  session: Session;
  participant: Participant;
  onAdvance: () => void;
}

export default function LocationInput({ session, participant, onAdvance }: Props) {
  const isAdmin = participant && session?.admin_participant_id === participant.id;
  const [zip, setZip] = useState(session.location_zip || '');
  const [city, setCity] = useState(session.location_city || '');
  const [searchType, setSearchType] = useState<'zip' | 'city'>('zip');

  const { setLocation } = useSession(session.id);
  const { data: theaters, isLoading, refetch } = useTheaters(
    searchType === 'zip' ? zip : undefined,
    searchType === 'city' ? city : undefined
  );

  // Auto-search when city or zip changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((searchType === 'zip' && zip.length === 5) || (searchType === 'city' && city.length > 0)) {
        handleSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [zip, city, searchType]);

  const handleSearch = async () => {
    if (searchType === 'zip' && zip.length === 5) {
      await setLocation({ zip });
      refetch();
    } else if (searchType === 'city' && city.length > 0) {
      await setLocation({ city });
      refetch();
    }
  };

  const selectedMovie = session.movieOptions.find(
    m => m.tmdb_id === session.selected_movie_id
  );

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Find Theaters</h3>

      {session.selected_date && selectedMovie && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-400">Your selection:</p>
          <p className="font-medium">
            <span className="text-cinema-accent">{selectedMovie.title}</span>
            {' on '}
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
        </div>
      )}

      <p className="text-gray-400 mb-6">
        Enter your location to find Utah theaters near you.
      </p>

      {/* Search type toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSearchType('zip')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            searchType === 'zip'
              ? 'bg-cinema-accent text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          By ZIP Code
        </button>
        <button
          onClick={() => setSearchType('city')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            searchType === 'city'
              ? 'bg-cinema-accent text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          By City
        </button>
      </div>

      {/* Search input */}
      <div className="flex gap-2 mb-6">
        {searchType === 'zip' ? (
          <input
            type="text"
            className="input flex-1"
            placeholder="Enter Utah ZIP code (e.g., 84101)"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            maxLength={5}
          />
        ) : (
          <input
            type="text"
            className="input flex-1"
            placeholder="Enter Utah city (e.g., Salt Lake City)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        )}
        <Button
          onClick={handleSearch}
          disabled={
            (searchType === 'zip' && zip.length !== 5) ||
            (searchType === 'city' && city.length === 0)
          }
          variant="primary"
        >
          Search
        </Button>
      </div>

      {/* Theaters list */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Searching theaters...</div>
      ) : theaters && theaters.length > 0 ? (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-300">
            {isAdmin ? 'Click a theater to see showtimes:' : `Theaters near ${session.location_city || session.location_zip}:`}
          </h4>
          {theaters.map((theater, index) => (
            <div
              key={index}
              onClick={() => isAdmin && onAdvance()}
              className={`p-4 bg-gray-800 rounded-lg flex items-center justify-between transition-all ${
                isAdmin
                  ? 'cursor-pointer hover:bg-gray-700 hover:ring-2 hover:ring-cinema-accent'
                  : ''
              }`}
            >
              <div>
                <p className="font-medium">{theater.name}</p>
                <p className="text-sm text-gray-400">{theater.address}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                    theater.chain === 'megaplex'
                      ? 'bg-blue-900 text-blue-300'
                      : 'bg-purple-900 text-purple-300'
                  }`}
                >
                  {theater.chain === 'megaplex' ? 'Megaplex' : 'Cinemark'}
                </span>
              </div>
              {isAdmin && (
                <div className="text-cinema-accent">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (session.location_zip || session.location_city) ? (
        <div className="text-center py-8 text-gray-400">
          No theaters found in this area. Try a different location.
        </div>
      ) : null}

      {/* Common Utah cities */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <p className="text-sm text-gray-400 mb-3">Popular Utah cities:</p>
        <div className="flex flex-wrap gap-2">
          {[
            'Salt Lake City',
            'Provo',
            'Sandy',
            'Orem',
            'Ogden',
            'Draper',
            'Lehi',
            'St. George',
          ].map(cityName => (
            <button
              key={cityName}
              onClick={() => {
                setSearchType('city');
                setCity(cityName);
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-sm transition-colors"
            >
              {cityName}
            </button>
          ))}
        </div>
      </div>

      {/* Continue button - shown when location is set */}
      {(session.location_zip || session.location_city) && (
        <div className="mt-6 pt-6 border-t border-gray-700">
          <Button
            onClick={onAdvance}
            variant="primary"
            className="w-full"
            disabled={!isAdmin}
          >
            {isAdmin ? 'Continue to Showtimes →' : 'Waiting for admin to continue...'}
          </Button>
          {!isAdmin && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Only the session admin can proceed to the next step.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
