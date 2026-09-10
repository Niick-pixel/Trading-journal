import { notFound } from 'next/navigation';
import { getTrade } from '@/db/trades';
import { NewTradeForm } from '@/components/capture/NewTradeForm';
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

  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[42rem] px-6 pb-20 pt-4">
          <NewTradeForm trade={trade ?? undefined} />
        </div>
      </div>
    </div>
  );
}
