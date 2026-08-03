const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export interface NormalizedEmail {
  original: string;
  normalized: string;
}

export function normalizeEmail(input: unknown): NormalizedEmail | null {
  if (typeof input !== "string") return null;

  const original = input.trim().normalize("NFKC");
  if (!original || original.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(original)) {
    return null;
  }

  return {
    original,
    normalized: original.toLowerCase(),
  };
}
