/**
 * Suggests a course name from its file names when the user doesn't give one:
 * strip the extension and everything from the week marker on, then take the name
 * most files share. "ENGR2722-8722 Signals and Systems - Week7.pdf" (and friends)
 * -> "ENGR2722-8722 Signals and Systems".
 */
const FROM_WEEK_ON = /[\s._-]*\b(?:week|wk|w)[\s._-]*\d{1,2}[a-z]?\b.*$/i;

function clean(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/_/g, " ") // first, so "Structures_Week_1" has a word boundary before "Week"
    .replace(FROM_WEEK_ON, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s-]+|[\s-]+$/g, "");
}

export function deriveTitle(filenames: string[], fallback = "New course"): string {
  const counts = new Map<string, number>();
  for (const name of filenames.map(clean).filter((n) => n.length >= 3)) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [name, count] of counts) {
    if (best === null || count > counts.get(best)!) best = name;
  }
  return best ?? fallback;
}
