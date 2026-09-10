import { NextResponse } from 'next/server';
import { DATA_DIR } from '@/lib/paths';
import { listTrades } from '@/db/trades';

export const dynamic = 'force-dynamic';

/** What the Settings panel shows. Where your journal lives is the whole point. */
export async function GET() {
  const trades = listTrades();
  return NextResponse.json({
    dataDir: DATA_DIR,
    trades: trades.length,
    screenshots: trades.length,
    oldest: trades.length ? trades[trades.length - 1].date : null,
  });
}
