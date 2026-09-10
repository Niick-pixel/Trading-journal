import { NextResponse } from 'next/server';
import { deleteTrade, getTrade, updateTrade } from '@/db/trades';
import { saveScreenshot, deleteScreenshot } from '@/db/screenshots';
import { parseTradeInput } from '@/lib/validate';

export async function GET(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const trade = getTrade((await ctx.params).id);
  return trade ? NextResponse.json(trade) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

/** Full edit. A new screenshot is optional — without one the existing file stays. */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = getTrade(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const form = await request.formData();
    const payload = form.get('trade');
    if (typeof payload !== 'string') {
      return NextResponse.json({ error: 'Malformed trade payload.' }, { status: 400 });
    }

    const image = form.get('screenshot');
    const replacing = image instanceof File && image.size > 0;

    const check = parseTradeInput({ ...JSON.parse(payload), screenshot_path: existing.screenshot_path });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const screenshot_path = replacing ? await saveScreenshot(image) : existing.screenshot_path;
    const updated = updateTrade(id, { ...check.value, screenshot_path });

    // Only drop the old image once the row actually points at the new one.
    if (replacing && updated) deleteScreenshot(existing.screenshot_path);

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not update the trade.' }, { status: 400 });
  }
}

export async function DELETE(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = deleteTrade((await ctx.params).id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
