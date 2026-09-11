import { NextResponse } from 'next/server';
import { dismissFlag, restoreFlag } from '@/db/trades';
import { FLAG_KEYS, type FlagKey } from '@/lib/flags';

function readFlag(body: unknown): FlagKey | null {
  const flag = (body as { flag?: unknown })?.flag;
  return typeof flag === 'string' && (FLAG_KEYS as readonly string[]).includes(flag)
    ? (flag as FlagKey)
    : null;
}

/** Dismiss a flag, recording why. Sometimes the contradiction is real. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const flag = readFlag(body);
  if (!flag) return NextResponse.json({ error: 'Unknown flag.' }, { status: 400 });

  const raw = (body as { reason?: unknown }).reason;
  const reason = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  dismissFlag(id, flag, reason);
  return NextResponse.json({ ok: true });
}

/** Un-dismiss it. */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const flag = new URL(request.url).searchParams.get('flag');
  if (!flag || !(FLAG_KEYS as readonly string[]).includes(flag)) {
    return NextResponse.json({ error: 'Unknown flag.' }, { status: 400 });
  }
  restoreFlag(id, flag);
  return NextResponse.json({ ok: true });
}
