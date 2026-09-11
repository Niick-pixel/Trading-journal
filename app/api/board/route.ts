import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/index';
import type { BoardEdge, BoardNote } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Sticky notes and hand-drawn links — the things the app could never infer. */
export async function GET() {
  const db = getDb();
  return NextResponse.json({
    notes: db.prepare('SELECT * FROM board_notes ORDER BY created_at').all() as unknown as BoardNote[],
    edges: db.prepare('SELECT * FROM board_edges ORDER BY created_at').all() as unknown as BoardEdge[],
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const db = getDb();

  if (body?.kind === 'note') {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO board_notes (id, body, x, y) VALUES (?, ?, ?, ?)')
      .run(id, typeof body.body === 'string' ? body.body : '', Number(body.x) || 0, Number(body.y) || 0);
    return NextResponse.json({ id }, { status: 201 });
  }

  if (body?.kind === 'edge') {
    if (typeof body.from_id !== 'string' || typeof body.to_id !== 'string') {
      return NextResponse.json({ error: 'An edge needs both ends.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO board_edges (id, from_id, to_id, label) VALUES (?, ?, ?, ?)')
      .run(id, body.from_id, body.to_id, typeof body.label === 'string' ? body.label : null);
    return NextResponse.json({ id }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown kind.' }, { status: 400 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const db = getDb();

  if (body.kind === 'note') {
    // Position and text update together so a drag and an edit are one write.
    db.prepare('UPDATE board_notes SET body = COALESCE(?, body), x = COALESCE(?, x), y = COALESCE(?, y) WHERE id = ?')
      .run(
        typeof body.body === 'string' ? body.body : null,
        Number.isFinite(Number(body.x)) ? Number(body.x) : null,
        Number.isFinite(Number(body.y)) ? Number(body.y) : null,
        body.id,
      );
    return NextResponse.json({ ok: true });
  }
  if (body.kind === 'edge') {
    db.prepare('UPDATE board_edges SET label = ? WHERE id = ?')
      .run(typeof body.label === 'string' ? body.label : null, body.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Unknown kind.' }, { status: 400 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const kind = url.searchParams.get('kind');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const table = kind === 'edge' ? 'board_edges' : 'board_notes';
  getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
