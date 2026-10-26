import type { Metadata } from "next";
import { Suspense } from "react";

import { EvaluasiView } from "./view";

export const metadata: Metadata = { title: "Evaluasi model" };

export default function Page() {
  return (
    <Suspense>
      <EvaluasiView />
    </Suspense>
  );
}
