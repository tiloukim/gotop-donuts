import { STORE_LAT, STORE_LNG, DELIVERY_TIERS, MAX_DELIVERY_MILES } from './constants';

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDeliveryFee(lat: number, lng: number): {
  distance: number;
  fee: number | null;
  available: boolean;
} {
  const distance = haversineDistance(STORE_LAT, STORE_LNG, lat, lng);

  if (distance > MAX_DELIVERY_MILES) {
    return { distance: Math.round(distance * 10) / 10, fee: null, available: false };
  }

  const tier = DELIVERY_TIERS.find(t => distance <= t.maxMiles);
  const fee = tier ? tier.fee : DELIVERY_TIERS[DELIVERY_TIERS.length - 1].fee;

  return { distance: Math.round(distance * 10) / 10, fee, available: true };
}
