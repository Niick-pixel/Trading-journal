import type { Trade } from './types';

export interface Hit {
  trade: Trade;
  /** Where it matched, for the result line. */
  field: 'explanation' | 'lesson' | 'reason' | 'setup' | 'mistake';
  /** A window of text around the match. */
  excerpt: string;
}

/**
 * Search across what I wrote, not what the app computed.
 *
 * The explanation and the lesson are the only free text in the journal, which
 * makes them the only place a half-remembered thought can be found again —
 * "that one where I said I was chasing it" is a real query and no filter
 * answers it.
 */
export function search(trades: Trade[], raw: string, limit = 40): Hit[] {
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: Hit[] = [];

  for (const trade of trades) {
    const fields: Array<[Hit['field'], string]> = [
      ['explanation', trade.explanation],
      ['lesson', trade.lesson ?? ''],
      ['reason', trade.reason],
      ['setup', trade.setup_type],
      ['mistake', trade.mistake_tags.join(', ')],
    ];

    for (const [field, text] of fields) {
      const at = text.toLowerCase().indexOf(q);
      if (at === -1) continue;
      // Enough either side to read the sentence it landed in.
      const from = Math.max(0, at - 48);
      const to = Math.min(text.length, at + q.length + 72);
      hits.push({
        trade,
        field,
        excerpt: `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`,
      });
      break; // One hit per trade — the first field that matched is enough.
    }
    if (hits.length >= limit) break;
  }

  return hits;
}
