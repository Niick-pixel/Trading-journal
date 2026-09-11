import { NextResponse } from 'next/server';
import { getWeeklyReview, listWeeklyReviews, saveWeeklyReview } from '@/db/reviews';

export async function GET(request: Request) {
  const week = new URL(request.url).searchParams.get('week');
  return NextResponse.json(week ? getWeeklyReview(week) : listWeeklyReviews());
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as
    { week_start?: unknown; summary?: unknown; reviewed_ids?: unknown } | null;
  if (typeof body?.week_start !== 'string') {
    return NextResponse.json({ error: 'Missing week_start.' }, { status: 400 });
  }
  const ids = Array.isArray(body.reviewed_ids)
    ? body.reviewed_ids.filter((v): v is string => typeof v === 'string') : [];
  return NextResponse.json(
    saveWeeklyReview(body.week_start, typeof body.summary === 'string' ? body.summary : '', ids),
  );
}
