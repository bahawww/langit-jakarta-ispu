import type { Metadata } from "next";
import { Suspense } from "react";

import { TrenView } from "./view";

export const metadata: Metadata = { title: "Tren" };

export default function Page() {
  return (
    <Suspense>
      <TrenView />
    </Suspense>
  );
}
