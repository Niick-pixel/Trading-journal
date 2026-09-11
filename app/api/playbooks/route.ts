import { NextResponse } from 'next/server';
import { archivePlaybook, createPlaybook, listPlaybooks, updatePlaybook } from '@/db/reviews';

export async function GET() {
  return NextResponse.json(listPlaybooks());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'A playbook needs a name.' }, { status: 400 });
  const criteria = typeof body?.criteria === 'string' && body.criteria.trim() ? body.criteria.trim() : null;
  const shot = typeof body?.reference_screenshot === 'string' ? body.reference_screenshot : null;
  return NextResponse.json(createPlaybook(name, criteria, shot), { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'A playbook needs a name.' }, { status: 400 });
  updatePlaybook(body.id, name, typeof body.criteria === 'string' ? body.criteria : null);
  return NextResponse.json({ ok: true });
}

/** Archived, not deleted — trades still point at it. */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  archivePlaybook(id);
  return NextResponse.json({ ok: true });
}
