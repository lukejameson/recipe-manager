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
