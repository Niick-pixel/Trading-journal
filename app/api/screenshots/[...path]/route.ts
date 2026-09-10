import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { resolveScreenshot } from '@/db/screenshots';

const CONTENT_TYPE: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
};

/**
 * Serves chart images out of ./data/screenshots. They live outside /public on
 * purpose — /public is bundled at build time, and this folder is user data that
 * changes constantly.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;

  let absolute: string;
  try {
    absolute = resolveScreenshot(segments.join('/'));
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  if (!fs.existsSync(absolute)) return new NextResponse('Not found', { status: 404 });

  const type = CONTENT_TYPE[path.extname(absolute).toLowerCase()];
  if (!type) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(fs.readFileSync(absolute) as unknown as BodyInit, {
    headers: {
      'Content-Type': type,
      // The filename carries a uuid, so a file at a given path never changes.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
