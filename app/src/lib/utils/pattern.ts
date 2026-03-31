export function matchesPattern(tagName: string, pattern: string): boolean {
  const normalizedTag = tagName.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  if (normalizedPattern.startsWith('*') && normalizedPattern.endsWith('*')) {
    return normalizedTag.includes(normalizedPattern.slice(1, -1));
  } else if (normalizedPattern.startsWith('*')) {
    return normalizedTag.endsWith(normalizedPattern.slice(1));
  } else if (normalizedPattern.endsWith('*')) {
    return normalizedTag.startsWith(normalizedPattern.slice(0, -1));
  } else {
    return normalizedTag === normalizedPattern;
  }
}
