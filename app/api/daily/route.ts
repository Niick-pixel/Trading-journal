import { NextResponse } from 'next/server';
import { getDailyReview, listDailyReviews, saveDailyReview } from '@/db/reviews';

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(request: Request) {
  const day = new URL(request.url).searchParams.get('day');
  if (day) {
    if (!isDay(day)) return NextResponse.json({ error: 'Expected YYYY-MM-DD.' }, { status: 400 });
    return NextResponse.json(getDailyReview(day));
  }
  return NextResponse.json(listDailyReviews());
}

/** One row per trading day, whether or not anything was traded. */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!isDay(body?.day)) return NextResponse.json({ error: 'Expected YYYY-MM-DD.' }, { status: 400 });

  const num = (v: unknown) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const clamp = (v: unknown) => {
    const n = num(v);
    return n == null ? null : Math.min(5, Math.max(1, Math.round(n)));
  };

  return NextResponse.json(saveDailyReview(body.day as string, {
    account: str(body.account),
    bias: str(body.bias),
    bias_screenshot: str(body.bias_screenshot),
    planned_killzones: str(body.planned_killzones),
    planned_levels: str(body.planned_levels),
    what_happened: str(body.what_happened),
    bias_held: body.bias_held == null ? null : body.bias_held === true,
    trades_planned: num(body.trades_planned),
    screen_minutes: num(body.screen_minutes),
    sleep_hours: num(body.sleep_hours),
    state_of_mind: clamp(body.state_of_mind),
    notes: str(body.notes),
  }));
}
