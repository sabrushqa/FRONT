/** Retourne l'URL si elle utilise un schema http/https, sinon null (ex. rejette javascript:). */
export function toSafeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
