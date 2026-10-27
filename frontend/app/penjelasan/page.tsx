import type { Metadata } from "next";
import { Suspense } from "react";

import { PenjelasanView } from "./view";

export const metadata: Metadata = { title: "Penjelasan model" };

export default function Page() {
  return (
    <Suspense>
      <PenjelasanView />
    </Suspense>
  );
}
