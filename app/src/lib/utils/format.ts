/**
 * Format minutes to human-readable time (e.g., "1h 30m")
 */
export function formatTime(minutes: number | null | undefined): string {
  if (!minutes) return '';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}m`;
  }
}

/**
 * Format servings count
 */
export function formatServings(servings: number | null | undefined): string {
  if (!servings) return '';
  return `${servings} serving${servings !== 1 ? 's' : ''}`;
}

/**
 * Parse duration from text and return seconds
 * Handles formats like: "1.5 hours", "90 minutes", "30 min", "1 hr", "2 hours", "45 seconds"
 * Returns null if no duration found
 */
export function parseDurationFromText(text: string): number | null {
  const patterns = [
    // Hours: "1.5 hours", "2 hr", "1 hour"
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/gi,
    // Minutes: "30 minutes", "45 min", "90 mins"
    /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/gi,
    // Seconds: "30 seconds", "45 sec"
    /(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)\b/gi,
  ];

  let totalSeconds = 0;
  let found = false;

  // Check for hours
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (hourMatch) {
    totalSeconds += parseFloat(hourMatch[1]) * 3600;
    found = true;
  }

  // Check for minutes
  const minMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/i);
  if (minMatch) {
    totalSeconds += parseFloat(minMatch[1]) * 60;
    found = true;
  }

  // Check for seconds
  const secMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)\b/i);
  if (secMatch) {
    totalSeconds += parseFloat(secMatch[1]);
    found = true;
  }

  return found ? Math.round(totalSeconds) : null;
}

/**
 * Format seconds to timer display (e.g., "1:30:00" or "05:30")
 */
export function formatTimerDisplay(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
