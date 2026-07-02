// Normalize a user-entered US phone number to E.164 (e.g. "+19035550199").
// Returns null if it doesn't look like a valid 10-digit US number.
export function toE164(input: string): string | null {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
