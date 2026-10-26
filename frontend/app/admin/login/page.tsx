import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginView } from "./view";

export const metadata: Metadata = { title: "Login admin", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
