import { Suspense } from "react";

import { OverviewView } from "./overview-view";

export default function Page() {
  return (
    <Suspense>
      <OverviewView />
    </Suspense>
  );
}
