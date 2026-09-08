/** Translation coverage excludes English fallbacks and obsolete or empty entries. */
export function translationCoverage(
  source: Record<string, string>,
  translation: Record<string, string>,
  baseTranslation: Record<string, string> = {}
): number {
  const keys = Object.keys(source);
  if (!keys.length) return 100;
  const translated = keys.filter(
    key => translation[key]?.trim() || baseTranslation[key]?.trim()
  ).length;
  return Math.floor((translated / keys.length) * 100);
}
