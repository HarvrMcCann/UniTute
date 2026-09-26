/**
 * Guesses which teaching week a file belongs to from its name, e.g.
 * "ENGR2722-8722 Signals and Systems - Week7.pdf" -> 7, "Wk 03 slides.pptx" -> 3.
 * Explicit week markers win; lecture/topic/module numbers are a fallback.
 * Returns null when nothing plausible (1-20) is found. The user can always correct it.
 */
const WEEK = /(?:^|[^a-z])(?:week|wk|w)[\s._-]*0*(\d{1,2})(?!\d)/i;
const FALLBACK = /(?:^|[^a-z])(?:lecture|lect|lec|topic|module|mod|session|section|chapter|ch|l)[\s._-]*0*(\d{1,2})(?!\d)/i;

export const MAX_WEEK = 20;

export function guessWeek(filename: string): number | null {
  const name = filename.replace(/\.[a-z0-9]+$/i, "");
  for (const pattern of [WEEK, FALLBACK]) {
    const match = name.match(pattern);
    if (match) {
      const week = Number(match[1]);
      if (week >= 1 && week <= MAX_WEEK) return week;
    }
  }
  return null;
}
