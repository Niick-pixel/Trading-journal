import { NextResponse } from 'next/server';
import { logError } from '@/lib/log';

/** Lets a failed screen record itself where a packaged app can be inspected. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  logError('client render', new Error(`${body?.message ?? 'unknown'}\n${body?.stack ?? ''}`));
  return NextResponse.json({ ok: true });
}
