import type { Metadata } from "next";
import { Suspense } from "react";

import { PrediksiView } from "./view";

export const metadata: Metadata = { title: "Prediksi" };

export default function Page() {
  return (
    <Suspense>
      <PrediksiView />
    </Suspense>
  );
}
