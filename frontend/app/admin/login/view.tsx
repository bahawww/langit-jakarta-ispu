"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { apiPost, ApiError, type Me } from "@/lib/api";

export function LoginView() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await apiPost<Me>("/auth/login", {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      await qc.invalidateQueries({ queryKey: ["/auth/me"] });
      // hanya path internal, cegah open redirect
      router.replace(next?.startsWith("/admin") ? next : "/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal terhubung ke server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-4 text-2xl font-semibold">Login admin</h1>
      <Card>
        <CardBody>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <Field label="Username" htmlFor="username">
              <Input id="username" name="username" autoComplete="username" required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            {error ? (
              <p role="alert" className="rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy}>
              <LogIn aria-hidden /> {busy ? "Memeriksa…" : "Masuk"}
            </Button>
          </form>
        </CardBody>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Dashboard publik bersifat read-only; login hanya untuk pengelola data.
      </p>
    </div>
  );
}
