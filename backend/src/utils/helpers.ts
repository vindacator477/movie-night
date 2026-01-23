export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTimeForDisplay(time: string): string {
  // Normalize time format
  const normalized = time.toLowerCase().replace(/\s/g, '');

  // Try to parse and format consistently
  const match = normalized.match(/(\d{1,2}):?(\d{2})?(am|pm)?/);

  if (match) {
    let hour = parseInt(match[1]);
    const minutes = match[2] || '00';
    const period = match[3] || (hour >= 12 ? 'pm' : 'am');

    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;

    return `${hour}:${minutes} ${period.toUpperCase()}`;
  }

  return time;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sanitizeInput(input: string, maxLength: number = 255): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '');
}
