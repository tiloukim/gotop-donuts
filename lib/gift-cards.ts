import { randomBytes } from 'crypto';

// No ambiguous chars: removed 0, O, 1, I, L
const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateGiftCardCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return `GTOP-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

export function normalizeGiftCardCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^GTOP/, 'GTOP-').replace(/^(GTOP-)([A-Z0-9]{4})([A-Z0-9]{4})$/, '$1$2-$3');
}

export function isValidGiftCardFormat(code: string): boolean {
  return /^GTOP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}
