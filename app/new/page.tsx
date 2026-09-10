import { NewTradeForm } from '@/components/capture/NewTradeForm';
import { TitleBar } from '@/components/shell/TitleBar';

export default function NewTradePage() {
  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[42rem] px-6 pb-20 pt-4">
          <NewTradeForm />
        </div>
      </div>
    </div>
  );
}
