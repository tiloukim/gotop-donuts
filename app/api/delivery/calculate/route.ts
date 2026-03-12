import { calculateDeliveryFee } from '@/lib/delivery';
import { NextRequest, NextResponse } from 'next/server';

async function geocodeAddress(street: string, city: string, state: string, zip: string): Promise<{ lat: number; lng: number } | null> {
  const address = `${street}, ${city}, ${state} ${zip}`;
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    countrycodes: 'us',
  })}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'GoTopDonuts/1.0' },
  });

  if (!response.ok) return null;

  const results = await response.json();
  if (results.length === 0) return null;

  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Support both direct lat/lng and address geocoding
  let lat = body.lat;
  let lng = body.lng;

  if (body.street && body.city && body.zip) {
    const coords = await geocodeAddress(body.street, body.city, body.state || 'TX', body.zip);
    if (!coords) {
      return NextResponse.json({ error: 'Could not find that address. Please check and try again.' }, { status: 400 });
    }
    lat = coords.lat;
    lng = coords.lng;
  }

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Address or coordinates required' }, { status: 400 });
  }

  const result = calculateDeliveryFee(lat, lng);
  return NextResponse.json({ ...result, lat, lng });
}
