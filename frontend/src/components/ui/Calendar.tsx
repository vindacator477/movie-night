import { useState } from 'react';

interface Props {
  selectedDates: string[];
  onDateSelect: (date: string) => void;
  minDate?: string;
  disabledDates?: string[];
}

export default function Calendar({ selectedDates, onDateSelect, minDate, disabledDates = [] }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : today;

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const formatDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const isDateDisabled = (date: Date): boolean => {
    const dateStr = formatDateString(date);
    return date < minDateObj || disabledDates.includes(dateStr);
  };

  const isDateSelected = (date: Date): boolean => {
    return selectedDates.includes(formatDateString(date));
  };

  const handleDateClick = (date: Date) => {
    if (!isDateDisabled(date)) {
      onDateSelect(formatDateString(date));
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isPrevMonthDisabled = currentMonth.getFullYear() === minDateObj.getFullYear() &&
                               currentMonth.getMonth() <= minDateObj.getMonth();

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          disabled={isPrevMonthDisabled}
          className={`p-2 rounded-lg ${
            isPrevMonthDisabled
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-lg font-semibold text-white">{monthName}</span>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded-lg text-gray-300 hover:bg-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs text-gray-500 font-medium py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="p-2" />;
          }

          const disabled = isDateDisabled(date);
          const selected = isDateSelected(date);
          const isToday = formatDateString(date) === formatDateString(today);

          return (
            <button
              key={formatDateString(date)}
              onClick={() => handleDateClick(date)}
              disabled={disabled}
              className={`
                p-2 text-sm rounded-lg transition-all relative
                ${disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'hover:bg-gray-700 cursor-pointer'
                }
                ${selected
                  ? 'bg-cinema-accent text-white hover:bg-cinema-accent/80'
                  : ''
                }
                ${isToday && !selected
                  ? 'ring-2 ring-cinema-accent/50'
                  : ''
                }
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Selected dates count */}
      {selectedDates.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400">
            {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
}
