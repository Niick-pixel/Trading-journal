# Signature

A local-only trade journal for an iFVG model on NQ/MNQ. It runs on your machine,
stores everything on disk, and never talks to a server you don't control.

It exists to expose **why** you take trades, not just what happened.

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
```

The database and screenshot folders are created automatically on first boot.
There is no seed data.

## Where your data lives

Everything Signature owns is inside `./data`:

```
data/
├── journal.db        SQLite database — every trade record
└── screenshots/      chart images, foldered by month (2026-09/…)
    └── 2026-09/
```

**Back up `./data` and you have backed up the entire journal.** Screenshots are
stored as ordinary image files and referenced by relative path from the database —
no image bytes are ever written into SQLite, so the `.db` file stays small and
the images stay openable in any image viewer.

`./data` is gitignored. Your trades never leave your machine.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run migrate` | Apply pending migrations without booting Next |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |

Migrations in `db/migrations/` run automatically on boot, in filename order,
each in its own transaction. Applied ones are recorded in `schema_migrations`.

## Stack

Next.js (App Router) + TypeScript · SQLite via better-sqlite3 · Tailwind CSS ·
Framer Motion · @xyflow/react. No auth, no cloud, no telemetry. One user.
