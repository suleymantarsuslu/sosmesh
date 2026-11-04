const CONFIRMED_TITLE = /^Koordinatör onaylı görev: (.+)$/;

/**
 * Tasks created from a confirmed assignment recommendation are stored with a fixed API title.
 * Show them in the operator's language; other titles are user content and stay untouched.
 */
export function displayTaskTitle(
  title: string,
  source: string,
  t: (key: string) => string
): string {
  if (source !== 'AI') {
    return title;
  }
  const match = CONFIRMED_TITLE.exec(title);
  return match ? t('web.tasks.confirmedTaskTitle').replace('{team}', match[1]) : title;
}
