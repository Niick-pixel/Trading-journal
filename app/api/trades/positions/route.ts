import { NextResponse } from 'next/server';
import { clearAllPositions, setPositions } from '@/db/trades';
import { logError } from '@/lib/log';

/**
 * Pins a batch of trades to explicit coordinates.
 *
 * The board calls this once for any trade that has no position yet, so a trade
 * keeps the spot it first landed in — across reloads, and when later trades are
 * added around it.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entries = Array.isArray(body?.positions) ? body.positions : [];
    const clean = entries
      .filter((e: unknown): e is { id: string; x: number; y: number } => {
        const v = e as { id?: unknown; x?: unknown; y?: unknown };
        return typeof v?.id === 'string' && Number.isFinite(v?.x) && Number.isFinite(v?.y);
      })
      .map((e: { id: string; x: number; y: number }) => ({ id: e.id, x: e.x, y: e.y }));

    setPositions(clean);
    return NextResponse.json({ ok: true, pinned: clean.length });
  } catch (err) {
    return NextResponse.json({ error: logError('POST /api/trades/positions', err) }, { status: 400 });
  }
}

/** Re-cluster: forget every manual placement and fall back to the auto layout. */
export async function DELETE() {
  clearAllPositions();
  return NextResponse.json({ ok: true });
}
