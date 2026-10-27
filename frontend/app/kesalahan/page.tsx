import type { Metadata } from "next";
import { Suspense } from "react";

import { KesalahanView } from "./view";

export const metadata: Metadata = { title: "Kesalahan model" };

export default function Page() {
  return (
    <Suspense>
      <KesalahanView />
    </Suspense>
  );
}
