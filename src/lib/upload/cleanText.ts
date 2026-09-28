/**
 * Makes extracted text safe to store and pleasant to read:
 * - removes NUL and other control characters (Postgres rejects NUL in text columns;
 *   maths-heavy PDFs produce them), keeping tabs and newlines
 * - trims trailing spaces and collapses runs of blank lines
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
