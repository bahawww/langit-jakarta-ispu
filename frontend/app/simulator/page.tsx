import type { Metadata } from "next";
import { Suspense } from "react";

import { SimulatorView } from "./view";

export const metadata: Metadata = { title: "Simulator" };

export default function Page() {
  return (
    <Suspense>
      <SimulatorView />
    </Suspense>
  );
}
