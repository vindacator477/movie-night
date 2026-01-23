import { useState } from 'react';
import { Session, Participant } from '../types';
import { useSession } from '../hooks/useSession';
import Card from './ui/Card';
import Button from './ui/Button';

interface Props {
  session: Session;
  participant: Participant;
}

export default function DateVoting({ session, participant }: Props) {
  const [newDates, setNewDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState('');
  const { addDates, voteForDate, removeVoteForDate } = useSession(session.id);

  const handleAddDate = () => {
    if (dateInput && !newDates.includes(dateInput)) {
      setNewDates([...newDates, dateInput]);
      setDateInput('');
    }
  };

  const handleRemoveNewDate = (date: string) => {
    setNewDates(newDates.filter(d => d !== date));
  };

  const handleSubmitDates = async () => {
    if (newDates.length > 0) {
      await addDates(newDates);
      setNewDates([]);
    }
  };

  const handleVote = async (dateId: string, hasVoted: boolean) => {
    if (hasVoted) {
      await removeVoteForDate({ dateId, participantId: participant.id });
    } else {
      await voteForDate({ dateId, participantId: participant.id });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get min date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Vote on Dates</h3>
      <p className="text-gray-400 mb-6">
        Add available dates and vote for the ones that work for you.
      </p>

      {/* Add new dates */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Add Available Dates
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            className="input flex-1"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            min={today}
          />
          <Button onClick={handleAddDate} disabled={!dateInput} variant="secondary">
            Add
          </Button>
        </div>

        {/* Pending dates to add */}
        {newDates.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-2">Dates to add:</p>
            <div className="flex flex-wrap gap-2">
              {newDates.map(date => (
                <span
                  key={date}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm flex items-center gap-2"
                >
                  {formatDate(date)}
                  <button
                    onClick={() => handleRemoveNewDate(date)}
                    className="text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <Button
              onClick={handleSubmitDates}
              variant="primary"
              size="sm"
              className="mt-3"
            >
              Submit Dates
            </Button>
          </div>
        )}
      </div>

      {/* Existing date options */}
      {session.dateOptions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-300">
            Click to vote for dates that work for you:
          </p>
          {session.dateOptions
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(dateOption => {
              const hasVoted = dateOption.votes.includes(participant.id);
              const voteCount = dateOption.votes.length;

              return (
                <div
                  key={dateOption.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    hasVoted
                      ? 'border-cinema-accent bg-cinema-accent/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => handleVote(dateOption.id, hasVoted)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          hasVoted
                            ? 'border-cinema-accent bg-cinema-accent'
                            : 'border-gray-500'
                        }`}
                      >
                        {hasVoted && (
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium">{formatDate(dateOption.date)}</span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {voteCount} vote{voteCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Show who voted */}
                  {dateOption.votes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 pl-9">
                      {dateOption.votes.map(voterId => {
                        const voter = session.participants.find(p => p.id === voterId);
                        return (
                          <span
                            key={voterId}
                            className="text-xs px-2 py-0.5 bg-gray-700 rounded"
                          >
                            {voter?.name || 'Unknown'}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          No dates added yet. Add some dates above!
        </div>
      )}
    </Card>
  );
}
