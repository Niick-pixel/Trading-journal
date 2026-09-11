import { NextResponse } from 'next/server';
import { getRiskLimits, setRiskLimits } from '@/db/reviews';

/** Informational. Nothing reads these to decide whether a save is allowed. */
export async function GET() {
  return NextResponse.json(getRiskLimits());
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : undefined);
  return NextResponse.json(setRiskLimits({
    max_trades_per_day: num(body?.max_trades_per_day),
    daily_loss_limit_r: num(body?.daily_loss_limit_r),
    max_risk_per_trade_pct: num(body?.max_risk_per_trade_pct),
  }));
}
