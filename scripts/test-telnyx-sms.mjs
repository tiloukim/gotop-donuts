#!/usr/bin/env node
// Throwaway end-to-end test for the new-order admin SMS.
// Sends ONE text via the Telnyx Messaging API so you can confirm the number
// works before relying on it in production.
//
// Usage:
//   TELNYX_API_KEY=KEY_xxx node scripts/test-telnyx-sms.mjs [toNumber]
//
// - TELNYX_API_KEY   required (not in .env.local — grab it from Vercel/Telnyx)
// - TELNYX_SMS_FROM  read from .env.local if present, else pass inline
// - toNumber         optional CLI arg; defaults to the admin (9033455599)
//
// Delete this file once you've confirmed delivery.

import { readFileSync } from 'node:fs';

// --- tiny .env.local loader (only fills vars not already in the environment) ---
try {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no .env.local — rely on real environment
}

function toE164(input) {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (input?.startsWith('+')) return input;
  return null;
}

const apiKey = process.env.TELNYX_API_KEY;
const from = process.env.TELNYX_SMS_FROM;
const to = toE164(process.argv[2] || process.env.ADMIN_SMS_PHONE || '9033455599');

if (!apiKey) {
  console.error('❌ TELNYX_API_KEY is not set. Run:');
  console.error('   TELNYX_API_KEY=KEY_xxx node scripts/test-telnyx-sms.mjs');
  process.exit(1);
}
if (!from) {
  console.error('❌ TELNYX_SMS_FROM is not set (checked env + .env.local).');
  process.exit(1);
}
if (!to) {
  console.error('❌ Could not parse a valid destination number.');
  process.exit(1);
}

const text = `GoTop test: new-order SMS alert wired up ✅ (from ${from})`;

console.log(`Sending test SMS  from ${from}  →  ${to} ...`);

const res = await fetch('https://api.telnyx.com/v2/messages', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ from, to, text }),
});

const bodyText = await res.text();

if (!res.ok) {
  console.error(`❌ Telnyx returned ${res.status}`);
  console.error(bodyText);
  console.error('\nCommon causes:');
  console.error('  • 401/403  → API key lacks access to this number/profile');
  console.error('  • 422      → number not SMS-enabled or not on a Messaging Profile');
  process.exit(1);
}

let id = '(unknown)';
try {
  id = JSON.parse(bodyText)?.data?.id ?? id;
} catch {}

console.log(`✅ Accepted by Telnyx. Message id: ${id}`);
console.log('   Check the destination phone for the text.');
console.log('   You can also confirm delivery in the Telnyx portal → Messaging logs.');
