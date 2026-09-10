import { NextResponse } from 'next/server';
import { getTrade, setPosition } from '@/db/trades';

/** Persists a manual drag so the arrangement survives a reload. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getTrade(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const x = Number(body?.x);
  const y = Number(body?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return NextResponse.json({ error: 'Invalid position.' }, { status: 400 });
  }

  setPosition(id, x, y);
  return NextResponse.json({ ok: true });
}
