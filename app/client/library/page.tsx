import { DemoClientLibraryPage } from "@/components/demo/demo-client-cabinet";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export default function ClientLibraryPage() {
  if (isDemoModeEnabled()) {
    return <DemoClientLibraryPage />;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-black px-4 text-zinc-400">
      Библиотека упражнений для основного режима будет подключена отдельно.
    </div>
  );
}
