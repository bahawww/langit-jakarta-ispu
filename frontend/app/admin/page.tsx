import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminView } from "./view";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AdminView />
    </Suspense>
  );
}
