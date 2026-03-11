import { calculateDeliveryFee } from '@/lib/delivery';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { lat, lng } = await request.json();

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const result = calculateDeliveryFee(lat, lng);
  return NextResponse.json(result);
}
