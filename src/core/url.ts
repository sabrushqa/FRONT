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

// Sans regex (Sonar S8786 : les motifs "^X+|X+$" sont signales comme
// backtracking super-lineaire) — boucles simples, strictement equivalentes.

/** Retire les "/" de fin de chaine. */
export function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charAt(end - 1) === '/') end--;
  return value.slice(0, end);
}

/** Retire les "/" de debut et de fin de chaine. */
export function stripLeadingAndTrailingSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charAt(start) === '/') start++;
  while (end > start && value.charAt(end - 1) === '/') end--;
  return value.slice(start, end);
}

/** Retire les "-" de debut et de fin de chaine (ex. slug genere avec des separateurs en trop). */
export function stripLeadingAndTrailingDashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charAt(start) === '-') start++;
  while (end > start && value.charAt(end - 1) === '-') end--;
  return value.slice(start, end);
}
