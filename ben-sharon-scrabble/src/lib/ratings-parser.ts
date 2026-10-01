export interface ParsedRatings { naspaRating: number | null; wgpoRating: number | null }
// Deliberately conservative: tournament history numbers are not current ratings.
// If Cross-Tables changes its markup, repair this module, not the UI or storage.
export function parseRatings(html: string): ParsedRatings {
  const plain = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');
  const read = (label: string) => {
    const pattern = new RegExp(`(?:current|latest)\\s+(?:${label})\\s+rating\\s*[:=]?\\s*(\\d{1,4})(?!\\d)`, 'gi');
    const values = [...plain.matchAll(pattern)].map(match => Number(match[1]));
    const unique = [...new Set(values)];
    return unique.length === 1 && unique[0] <= 4000 ? unique[0] : null;
  };
  const result = { naspaRating: read('NASPA(?:\\s*[/–-]\\s*NWL)?|NWL'), wgpoRating: read('WGPO') };
  if (result.naspaRating === null && result.wgpoRating === null) throw new Error('Current ratings could not be identified confidently. Saved ratings have been kept.');
  return result;
}
