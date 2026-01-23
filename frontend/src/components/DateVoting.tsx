import { useState } from 'react';
import { Session, Participant } from '../types';
import { useSession } from '../hooks/useSession';
import Card from './ui/Card';
import Button from './ui/Button';
import Calendar from './ui/Calendar';

interface Props {
  session: Session;
  participant: Participant;
}

export default function DateVoting({ session, participant }: Props) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const { addDates, voteForDate, removeVoteForDate } = useSession(session.id);

  // Get dates that are already added to the session
  const existingDates = session.dateOptions.map(d => d.date.split('T')[0]);

  const handleDateSelect = (date: string) => {
    if (selectedDates.includes(date)) {
      setSelectedDates(selectedDates.filter(d => d !== date));
    } else {
      setSelectedDates([...selectedDates, date]);
    }
  };

  const handleSubmitDates = async () => {
    if (selectedDates.length > 0) {
      await addDates(selectedDates);
      setSelectedDates([]);
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
    // Normalize date string - extract YYYY-MM-DD if it's a full ISO datetime
    const normalizedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const date = new Date(normalizedDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4">Vote on Dates</h3>
      <p className="text-gray-400 mb-6">
        Select available dates from the calendar and vote for the ones that work for you.
      </p>

      {/* Calendar for adding new dates */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Select Available Dates
        </label>
        <Calendar
          selectedDates={selectedDates}
          onDateSelect={handleDateSelect}
          minDate={today}
          disabledDates={existingDates}
        />

        {/* Submit selected dates */}
        {selectedDates.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedDates.sort().map(date => (
                <span
                  key={date}
                  className="px-3 py-1 bg-cinema-accent/20 text-cinema-accent rounded-full text-sm"
                >
                  {formatDate(date)}
                </span>
              ))}
            </div>
            <Button onClick={handleSubmitDates} variant="primary">
              Add {selectedDates.length} Date{selectedDates.length !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </div>

      {/* Existing date options to vote on */}
      {session.dateOptions.length > 0 && (
        <div className="border-t border-gray-700 pt-6">
          <p className="text-sm font-medium text-gray-300 mb-3">
            Click to vote for dates that work for you:
          </p>
          <div className="space-y-3">
            {session.dateOptions
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map(dateOption => {
                const votes = Array.isArray(dateOption.votes) ? dateOption.votes : [];
                const hasVoted = votes.includes(participant.id);
                const voteCount = votes.length;

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
                    {voteCount > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 pl-9">
                        {votes.map(voterId => {
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
        </div>
      )}

      {session.dateOptions.length === 0 && selectedDates.length === 0 && (
        <div className="text-center py-4 text-gray-400">
          Select dates from the calendar above to get started!
        </div>
      )}
    </Card>
  );
}
