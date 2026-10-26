"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, RotateCcw, Upload, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  apiGet,
  apiPost,
  ApiError,
  useApi,
  type Me,
  type ModelVersion,
  type QueuedOut,
  type TrainingRun,
  type UploadDetail,
  type UploadOut,
} from "@/lib/api";
import { fmt } from "@/lib/format";

const MAX_BYTES = 5 * 1024 * 1024;
const REFRESH_KEYS = [
  "/models",
  "/models/champions",
  "/forecast",
  "/training-runs",
  "/admin/uploads",
  "/meta",
];

function useRefreshAll() {
  const qc = useQueryClient();
  return useCallback(
    () => Promise.all(REFRESH_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
    [qc],
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{fmt.int(value)}</p>
    </div>
  );
}

function UploadReport({ upload }: { upload: UploadOut }) {
  const detail = useApi<UploadDetail>(`/admin/uploads/${upload.id}`);
  return (
    <div className="grid gap-3" aria-live="polite">
      <p className="text-sm">
        <strong>{upload.filename}</strong> · {upload.status === "success" ? "berhasil" : "gagal"} ·{" "}
        {upload.format === "raw"
          ? "format mentah"
          : upload.format === "clean"
            ? "format bersih"
            : "format tidak dikenali"}{" "}
        · {fmt.dateTime(upload.created_at)}
      </p>
      {upload.error ? (
        <p role="alert" className="rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
          {upload.error}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Total baris file" value={upload.total_rows} />
          <Stat label="Baris baru" value={upload.inserted} />
          <Stat label="Di-update" value={upload.updated} />
          <Stat label="Tidak berubah" value={upload.unchanged} />
          <Stat label="Ditolak" value={upload.rejected} />
        </div>
      )}
      {upload.retrain_queued === true ? (
        <p className="text-sm">Data berubah, retraining otomatis sudah diantrekan.</p>
      ) : upload.retrain_queued === false ? (
        <p role="alert" className="text-sm text-destructive">
          Data tersimpan, tetapi retraining gagal diantrekan (worker tidak tersedia). Klik “Latih
          ulang sekarang”.
        </p>
      ) : upload.status === "success" ? (
        <p className="text-sm text-muted-foreground">
          Tidak ada perubahan data, retraining tidak diperlukan.
        </p>
      ) : null}
      {upload.rejected > 0 ? (
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Lihat alasan baris ditolak ({fmt.int(upload.rejected)})
          </summary>
          <QueryView query={detail} skeleton={<Skeleton className="mt-2 h-24 w-full" />}>
            {(d) => (
              <div className="mt-2 max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Baris yang ditolak</caption>
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-1 pr-3 font-medium">
                        Baris
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        Alasan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rejected_details.map((r) => (
                      <tr key={r.line} className="border-t border-border">
                        <td className="py-1 pr-3">{r.line}</td>
                        <td className="py-1">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryView>
        </details>
      ) : null}
    </div>
  );
}

function UploadCard() {
  const refresh = useRefreshAll();
  const input = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadOut | null>(null);
  const history = useApi<UploadOut[]>("/admin/uploads", { limit: 10 });
  const upload = useMutation<UploadOut, ApiError, File>({
    mutationFn: (file) => {
      const form = new FormData();
      form.append("file", file);
      return apiPost<UploadOut>("/admin/uploads", form);
    },
    onSuccess: (u) => {
      setResult(u);
      if (input.current) input.current.value = "";
      void refresh();
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = input.current?.files?.[0];
    setClientError(null);
    if (!file) return setClientError("Pilih file CSV terlebih dahulu");
    if (!file.name.toLowerCase().endsWith(".csv"))
      return setClientError("Hanya file .csv yang diterima");
    if (file.size > MAX_BYTES) return setClientError("Ukuran file maksimal 5 MB");
    upload.mutate(file);
  }

  const error = clientError ?? upload.error?.message;
  return (
    <Card aria-labelledby="h-upload">
      <CardHeader
        id="h-upload"
        title="Upload data CSV"
        description="Format mentah Satu Data Jakarta atau format bersih. Baris di-upsert per (tanggal, stasiun); baris N/A ditolak beserta alasannya."
      />
      <CardBody className="grid gap-4">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="csv" className="text-xs font-medium text-muted-foreground">
              File CSV (maks. 5 MB)
            </label>
            <input
              ref={input}
              id="csv"
              name="file"
              type="file"
              accept=".csv,text/csv"
              aria-describedby={error ? "csv-error" : undefined}
              className="min-h-11 w-full rounded-md border border-border bg-card p-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5"
            />
          </div>
          <Button type="submit" disabled={upload.isPending}>
            <Upload aria-hidden /> {upload.isPending ? "Memproses…" : "Upload"}
          </Button>
        </form>
        {error ? (
          <p id="csv-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {result ? <UploadReport upload={result} /> : null}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Riwayat upload</h3>
          <QueryView
            query={history}
            skeleton={<Skeleton className="h-24 w-full" />}
            isEmpty={(d) => d.length === 0}
          >
            {(rows) => (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Riwayat upload</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Waktu
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        File
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Sumber
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Status
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Baru
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Update
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Ditolak
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {fmt.dateTime(u.created_at)}
                        </td>
                        <td className="py-2 pr-3">{u.filename}</td>
                        <td className="py-2 pr-3">{u.source}</td>
                        <td className="py-2 pr-3">{u.status}</td>
                        <td className="py-2 pr-3 text-right">{fmt.int(u.inserted)}</td>
                        <td className="py-2 pr-3 text-right">{fmt.int(u.updated)}</td>
                        <td className="py-2 text-right">{fmt.int(u.rejected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryView>
        </div>
      </CardBody>
    </Card>
  );
}

function TrainingCard() {
  const refresh = useRefreshAll();
  const [queuedAt, setQueuedAt] = useState<number | null>(null);
  const runs = useQuery<TrainingRun[], ApiError>({
    queryKey: ["/training-runs", { limit: 8 }],
    queryFn: () => apiGet("/training-runs", { limit: 8 }),
    // Poll selama ada training berjalan atau baru diantrekan (< 3 menit).
    refetchInterval: (q) => {
      const running = q.state.data?.some((r) => r.status === "running");
      return running || (queuedAt && Date.now() - queuedAt < 180_000) ? 3000 : false;
    },
  });
  const latest = runs.data?.[0];
  const wasRunning = useRef(false);
  useEffect(() => {
    const running = latest?.status === "running";
    if (wasRunning.current && !running) void refresh();
    wasRunning.current = running;
  }, [latest?.status, refresh]);

  const train = useMutation<QueuedOut, ApiError>({
    mutationFn: () => apiPost<QueuedOut>("/admin/train"),
    onSuccess: () => {
      setQueuedAt(Date.now());
      void runs.refetch();
    },
  });

  return (
    <Card aria-labelledby="h-train">
      <CardHeader
        id="h-train"
        title="Status training"
        description="Retraining otomatis setelah ingest yang mengubah data, dan mingguan (Minggu 02.00 WIB). Model baru hanya dipromosikan jika metrik holdout ≥ champion."
        action={
          <Button
            onClick={() => train.mutate()}
            disabled={train.isPending || latest?.status === "running"}
          >
            <Zap aria-hidden /> Latih ulang sekarang
          </Button>
        }
      />
      <CardBody>
        {train.error ? (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {train.error.message}
          </p>
        ) : train.isSuccess ? (
          <p className="mb-3 text-sm" aria-live="polite">
            Training diantrekan. Status diperbarui otomatis.
          </p>
        ) : null}
        <QueryView
          query={runs}
          skeleton={<Skeleton className="h-32 w-full" />}
          isEmpty={(d) => d.length === 0}
        >
          {(d) => (
            <ul className="space-y-2 text-sm" aria-live="polite">
              {d.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">
                    #{r.id} · {r.trigger} ·{" "}
                    <span className={r.status === "failed" ? "text-destructive" : undefined}>
                      {r.status}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt.dateTime(r.created_at)}
                    {r.finished_at ? ` → ${fmt.dateTime(r.finished_at)}` : " · sedang berjalan…"}
                  </p>
                  {r.message ? <p className="mt-1">{r.message}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </QueryView>
      </CardBody>
    </Card>
  );
}

function RegistryCard() {
  const refresh = useRefreshAll();
  const models = useApi<ModelVersion[]>("/models");
  const [confirm, setConfirm] = useState<number | null>(null);
  const rb = useMutation<TrainingRun, ApiError, number>({
    mutationFn: (id) => apiPost<TrainingRun>(`/admin/models/${id}/rollback`),
    onSuccess: () => {
      setConfirm(null);
      void refresh();
    },
  });

  return (
    <Card aria-labelledby="h-registry">
      <CardHeader
        id="h-registry"
        title="Model registry"
        description="Rollback menjadikan versi lama champion lagi dan membuat ulang forecast."
      />
      <CardBody>
        {rb.error ? (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {rb.error.message}
          </p>
        ) : rb.data ? (
          <p className="mb-3 text-sm" aria-live="polite">
            {rb.data.message}
          </p>
        ) : null}
        <QueryView
          query={models}
          skeleton={<Skeleton className="h-32 w-full" />}
          isEmpty={(d) => d.length === 0}
        >
          {(d) => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Versi model</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Task
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Versi
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Algoritma
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Data sampai
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Metrik utama
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3">
                        {v.task === "forecast" ? "Forecast" : "Klasifikasi"}
                      </td>
                      <td className="py-2 pr-3">v{v.version}</td>
                      <td className="py-2 pr-3">{v.algorithm}</td>
                      <td className="py-2 pr-3">{v.status}</td>
                      <td className="py-2 pr-3">{fmt.date(v.data_end)}</td>
                      <td className="py-2 pr-3">
                        {v.primary_metric} = {fmt.num(v.primary_value)}
                      </td>
                      <td className="py-2 text-right">
                        {v.status === "champion" ? (
                          <span className="text-xs text-muted-foreground">aktif</span>
                        ) : confirm === v.id ? (
                          <span className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={rb.isPending}
                              onClick={() => rb.mutate(v.id)}
                            >
                              Ya, rollback ke v{v.version}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                              Batal
                            </Button>
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirm(v.id)}>
                            <RotateCcw aria-hidden /> Rollback
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryView>
      </CardBody>
    </Card>
  );
}

export function AdminView() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useQuery<Me, ApiError>({
    queryKey: ["/auth/me"],
    queryFn: () => apiGet("/auth/me"),
    retry: false,
  });
  const unauthorized = me.error?.status === 401;
  useEffect(() => {
    if (unauthorized) router.replace("/admin/login?next=/admin");
  }, [unauthorized, router]);

  async function logout() {
    await apiPost("/auth/logout");
    qc.removeQueries({ queryKey: ["/auth/me"] });
    router.replace("/admin/login");
  }

  if (me.isPending || unauthorized) {
    return (
      <div role="status" aria-label="Memeriksa sesi">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (me.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {me.error.message}
      </p>
    );
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Masuk sebagai {me.data.username}.</p>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut aria-hidden /> Keluar
        </Button>
      </div>
      <div className="grid gap-5">
        <UploadCard />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <TrainingCard />
          <RegistryCard />
        </div>
      </div>
    </>
  );
}
