// Helpers for checking whether the shop is currently open against store_hours.
// Times in store_hours are stored as TIME (HH:MM:SS) in the shop's local timezone.

const STORE_TIMEZONE = 'America/Chicago' // Tyler, TX

const DAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

interface StoreHoursRow {
  day_of_week: number
  open_time: string | null
  close_time: string | null
  delivery_start: string | null
  delivery_end: string | null
  is_closed: boolean | null
}

function getNowInStoreTZ(): { dayOfWeek: number; hhmm: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = fmt.formatToParts(new Date())
  const weekday = parts.find(p => p.type === 'weekday')?.value || 'Sun'
  const hour = parts.find(p => p.type === 'hour')?.value || '00'
  const minute = parts.find(p => p.type === 'minute')?.value || '00'
  return { dayOfWeek: DAY_INDEX[weekday] ?? 0, hhmm: `${hour}:${minute}` }
}

function trimToHHMM(t: string | null): string | null {
  return t ? t.slice(0, 5) : null
}

/**
 * Check if the shop is currently open for an ASAP order of the given type.
 * Returns a user-friendly error string if closed, or null if open.
 * Pickup uses open_time / close_time. Delivery uses delivery_start / delivery_end
 * when both are set, otherwise falls back to open_time / close_time.
 */
export async function checkShopOpenForASAP(
  svc: { from: (table: string) => any },
  orderType: 'pickup' | 'delivery'
): Promise<string | null> {
  const { dayOfWeek, hhmm } = getNowInStoreTZ()

  const { data } = await svc
    .from('store_hours')
    .select('day_of_week, open_time, close_time, delivery_start, delivery_end, is_closed')
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()
  const row = data as StoreHoursRow | null

  if (!row) {
    return 'Shop hours are not configured. Please choose Schedule for Later.'
  }

  if (row.is_closed) {
    return 'Sorry, the shop is closed today. Please choose Schedule for Later for a future date.'
  }

  let openAt: string | null = null
  let closeAt: string | null = null

  if (orderType === 'delivery' && row.delivery_start && row.delivery_end) {
    openAt = trimToHHMM(row.delivery_start)
    closeAt = trimToHHMM(row.delivery_end)
  } else {
    openAt = trimToHHMM(row.open_time)
    closeAt = trimToHHMM(row.close_time)
  }

  if (!openAt || !closeAt) {
    return 'Shop hours are not configured for this order type. Please choose Schedule for Later.'
  }

  if (hhmm < openAt || hhmm > closeAt) {
    const window =
      orderType === 'delivery' ? `delivery hours are ${openAt}–${closeAt}` : `we open ${openAt} and close ${closeAt}`
    return `Sorry, the shop is closed right now (${window}). Please choose Schedule for Later for a future pickup or delivery time.`
  }

  return null
}
