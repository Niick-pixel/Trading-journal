import { NextResponse } from 'next/server';
import { restoreTrade } from '@/db/trades';

/** Out of the Trash and back onto the board. */
export async function POST(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = restoreTrade((await ctx.params).id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
