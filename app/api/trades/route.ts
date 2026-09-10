import { NextResponse } from 'next/server';
import { createTrade, listTrades } from '@/db/trades';
import { deleteScreenshot, saveScreenshot } from '@/db/screenshots';
import { parseTradeInput } from '@/lib/validate';
import type { Outcome, Reason, Session } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const list = (key: string) => q.getAll(key).flatMap((v) => v.split(',')).filter(Boolean);
  const int = (key: string) => (q.get(key) ? Number(q.get(key)) : undefined);

  return NextResponse.json(listTrades({
    from: q.get('from') ?? undefined,
    to: q.get('to') ?? undefined,
    outcomes: list('outcome') as Outcome[],
    reasons: list('reason') as Reason[],
    sessions: list('session') as Session[],
    minGrade: int('minGrade'),
    maxGrade: int('maxGrade'),
  }));
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get('screenshot');
    const payload = form.get('trade');

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: 'A screenshot is required.' }, { status: 400 });
    }
    if (typeof payload !== 'string') {
      return NextResponse.json({ error: 'Malformed trade payload.' }, { status: 400 });
    }

    let json: unknown;
    try {
      json = JSON.parse(payload);
    } catch {
      return NextResponse.json({ error: 'Malformed trade payload.' }, { status: 400 });
    }

    // Validate before touching the disk, or a rejected payload leaves an
    // orphaned image behind. 'pending' stands in for the path we haven't
    // written yet; only its presence is checked at this stage.
    const check = parseTradeInput({ ...(json as object), screenshot_path: 'pending' });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const screenshot_path = await saveScreenshot(image);

    try {
      return NextResponse.json(createTrade({ ...check.value, screenshot_path }), { status: 201 });
    } catch (err) {
      // The row didn't land, so the file must not survive either.
      deleteScreenshot(screenshot_path);
      throw err;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save the trade.' },
      { status: 400 },
    );
  }
}
