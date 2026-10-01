import { NextResponse } from 'next/server';
import { getRatings } from '@/lib/ratings-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({ ratings: await getRatings() }, { headers: { 'Cache-Control': 'private, no-store' } });
}
