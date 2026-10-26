import type { Metadata } from "next";
import { Suspense } from "react";

import { DataView } from "./view";

export const metadata: Metadata = { title: "Data" };

export default function Page() {
  return (
    <Suspense>
      <DataView />
    </Suspense>
  );
}
