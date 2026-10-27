import type { Metadata } from "next";
import { Suspense } from "react";

import { DataHub } from "./hub";

export const metadata: Metadata = { title: "Data" };

export default function Page() {
  return (
    <Suspense>
      <DataHub />
    </Suspense>
  );
}
