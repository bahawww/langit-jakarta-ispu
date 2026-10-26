import type { Metadata } from "next";
import { Suspense } from "react";

import { StasiunView } from "./view";

export const metadata: Metadata = { title: "Per stasiun" };

export default function Page() {
  return (
    <Suspense>
      <StasiunView />
    </Suspense>
  );
}
