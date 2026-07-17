import type { ReactNode } from "react";

import { TrainerDemoRuntimeProvider } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";

export default function TrainerLayout({ children }: { children: ReactNode }) {
  return <TrainerDemoRuntimeProvider>{children}</TrainerDemoRuntimeProvider>;
}
