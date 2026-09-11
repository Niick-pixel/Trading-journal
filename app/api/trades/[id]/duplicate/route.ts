import { NextResponse } from 'next/server';
import { duplicateTrade } from '@/db/trades';

/** A second entry on the same setup. The outcome is deliberately not copied. */
export async function POST(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const copy = duplicateTrade((await ctx.params).id);
  return copy
    ? NextResponse.json(copy, { status: 201 })
    : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
