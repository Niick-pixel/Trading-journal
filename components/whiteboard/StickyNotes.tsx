'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import type { BoardNote } from '@/lib/types';

/**
 * Conclusions, written next to the cluster that produced them.
 *
 * A realisation about the FOMO cluster is worth almost nothing in a separate
 * notes app and almost everything pinned to the FOMO cluster, which is the
 * entire argument for a whiteboard over a table.
 */
export function StickyNotes({ notes, onChanged }: { notes: BoardNote[]; onChanged: () => void }) {
  const [local, setLocal] = useState(notes);
  useEffect(() => setLocal(notes), [notes]);

  const save = useCallback(async (id: string, patch: Partial<BoardNote>) => {
    await fetch('/api/board', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'note', id, ...patch }),
    });
  }, []);

  async function remove(id: string) {
    await fetch(`/api/board?kind=note&id=${id}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <>
      {local.map((note) => (
        <Note key={note.id} note={note} onSave={save} onRemove={remove} />
      ))}
    </>
  );
}

function Note({ note, onSave, onRemove }: {
  note: BoardNote;
  onSave: (id: string, patch: Partial<BoardNote>) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const [body, setBody] = useState(note.body);
  const timer = useRef<number | null>(null);

  // Debounced, because a sticky note is typed into continuously and one
  // request per keystroke would be absurd.
  const onType = (value: string) => {
    setBody(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onSave(note.id, { body: value }), 600);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={false}
      onDragEnd={(_, info) => {
        onSave(note.id, { x: note.x + info.offset.x, y: note.y + info.offset.y });
        // The server is the source of truth for position; the local copy is
        // updated on the next board refresh rather than guessed at here.
      }}
      transition={spring}
      className="group absolute z-[5] w-56 rounded-[16px] p-3"
      style={{
        left: note.x,
        top: note.y,
        background: 'rgb(var(--amber) / 0.13)',
        border: '1px solid rgb(var(--amber) / 0.35)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'grab',
      }}
    >
      <button
        type="button"
        aria-label="Delete note"
        onClick={() => onRemove(note.id)}
        className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--glass-stroke)', color: 'var(--text-dim)' }}
      >
        ×
      </button>
      <textarea
        value={body}
        onChange={(e) => onType(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="What did you conclude?"
        className="w-full resize-none bg-transparent text-[12px] leading-snug outline-none"
        style={{ color: 'var(--text)', minHeight: 72, cursor: 'text' }}
      />
    </motion.div>
  );
}
