import { notFound } from 'next/navigation';
import { getTrade, listTrades } from '@/db/trades';
import { NewTradeForm } from '@/components/capture/NewTradeForm';
import { Whiteboard } from '@/components/whiteboard/Whiteboard';
import { TitleBar } from '@/components/shell/TitleBar';

export const dynamic = 'force-dynamic';

/** `?edit=<id>` reopens the same form pre-filled instead of starting a new one. */
export default async function NewTradePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const trade = edit ? getTrade(edit) : null;
  if (edit && !trade) notFound();

  const trades = listTrades();

  return (
    <div className="relative h-dvh overflow-hidden">
      {/*
        The board stays behind the capture form, blurred and inert. Replacing it
        with a blank page made logging a trade feel like leaving the app; this
        way the thing you are adding to is still visibly there.
      */}
      {trades.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none"
          style={{ filter: 'blur(18px) saturate(0.85)', opacity: 0.5, transform: 'scale(1.04)' }}
        >
          <div className="h-dvh pt-11">
            <Whiteboard trades={trades} readOnly />
          </div>
        </div>
      )}

      <div className="relative flex h-dvh flex-col">
        <TitleBar />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/*
            Wide, and dynamic with the window.
            The form grew past what a single 42rem column could hold without
            becoming a scroll marathon. It now uses whatever width the window
            gives it, up to a readable ceiling, and the card inside lays its
            sections out in one, two or three columns to match.
          */}
          <div className="mx-auto w-full max-w-[96rem] px-4 pb-20 pt-4 sm:px-6">
            <NewTradeForm trade={trade ?? undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
