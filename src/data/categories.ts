/** Question categories as stored in the database, with their on-screen labels. */
export const CATEGORY_OPTIONS = [
  { value: 'teknoloji', label: 'Teknoloji' },
  { value: 'bilim', label: 'Bilim' },
  { value: 'genel', label: 'Genel Kültür' },
  { value: 'mantık', label: 'Mantık' },
] as const;

export type CategoryCode = (typeof CATEGORY_OPTIONS)[number]['value'];

/** Human-readable label for a category code; unknown codes are returned capitalised. */
export const categoryLabel = (code: string): string => {
  const known = CATEGORY_OPTIONS.find((c) => c.value === code);
  if (known) return known.label;
  if (!code) return '';
  return code.charAt(0).toLocaleUpperCase('tr-TR') + code.slice(1);
};
