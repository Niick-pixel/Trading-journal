import { listTrades } from '@/db/trades';
import { getDailyReview } from '@/db/reviews';
import { TitleBar } from '@/components/shell/TitleBar';
import { DailyReviewForm } from '@/components/review/DailyReviewForm';

export const dynamic = 'force-dynamic';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * One record per trading day, independent of whether anything was traded.
 *
 * The bias and the levels are written before the session; what actually
 * happened is written after. Sleep and state of mind are here as correlation
 * data, not as a diary — the question they answer is whether five hours of
 * sleep is what actually breaks the rules.
 */
export default async function DayPage(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> },
) {
  const asked = (await searchParams).day;
  const day = typeof asked === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today();
  const onDay = listTrades().filter((t) => t.date.slice(0, 10) === day);

  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[46rem] px-6 pb-20 pt-4">
          <DailyReviewForm day={day} existing={getDailyReview(day)} tradesOnDay={onDay.length} />
        </div>
      </div>
    </div>
  );
}
