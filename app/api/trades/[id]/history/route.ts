import { NextResponse } from 'next/server';
import { tradeHistory } from '@/db/trades';

/** Everything that has changed on this trade since it was written. */
export async function GET(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  return NextResponse.json(tradeHistory((await ctx.params).id));
}
