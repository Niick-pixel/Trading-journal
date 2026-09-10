import { NextResponse } from 'next/server';
import { clearAllPositions } from '@/db/trades';

/** Re-cluster: forget every manual placement and fall back to the auto layout. */
export async function DELETE() {
  clearAllPositions();
  return NextResponse.json({ ok: true });
}
