import * as React from "react";

import { cn } from "@/lib/utils";

/** Kartu design system: surface + border 1px + radius-lg + padding 24px, isi tersusun vertikal. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("ua-card min-w-0", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="ua-card__head">
      <div className="min-w-0">
        <h2 id={id} className="ua-card__title text-balance">
          {title}
        </h2>
        {description ? <p className="ua-card__sub mt-0.5">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4", className)} {...props} />
  );
}
