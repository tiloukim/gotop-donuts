import { STORE_LAT, STORE_LNG, DELIVERY_TIERS, MAX_DELIVERY_MILES } from './constants';

// Get driving distance in miles using OSRM (free, no API key)
async function drivingDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): Promise<number> {
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
  const response = await fetch(url);

  if (!response.ok) throw new Error('Routing service unavailable');

  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('No route found');
  }

  // OSRM returns distance in meters, convert to miles
  return data.routes[0].distance / 1609.344;
}

export async function calculateDeliveryFee(lat: number, lng: number): Promise<{
  distance: number;
  fee: number | null;
  available: boolean;
}> {
  const distance = await drivingDistance(STORE_LAT, STORE_LNG, lat, lng);
  const rounded = Math.round(distance * 10) / 10;

  if (distance > MAX_DELIVERY_MILES) {
    return { distance: rounded, fee: null, available: false };
  }

  const tier = DELIVERY_TIERS.find(t => distance <= t.maxMiles);
  const fee = tier ? tier.fee : DELIVERY_TIERS[DELIVERY_TIERS.length - 1].fee;

  return { distance: rounded, fee, available: true };
}
