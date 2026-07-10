import { DemoClientLibraryContent } from "@/components/demo/demo-client-cabinet";
import { TrainerShell } from "@/components/trainer/trainer-shell";

export default function TrainerLibraryPage() {
  return (
    <TrainerShell
      eyebrow="Библиотека"
      title="Библиотека упражнений"
      description="Найдите упражнение, посмотрите технику и быстро откройте нужную группу мышц."
    >
      <div className="min-h-screen bg-black px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1480px]">
          <DemoClientLibraryContent />
        </div>
      </div>
    </TrainerShell>
  );
}
