import { useQuery } from "@tanstack/react-query";

import type { components } from "./api-types";

export type Schemas = components["schemas"];
export type Meta = Schemas["MetaOut"];
export type Summary = Schemas["SummaryOut"];
export type Measurement = Schemas["MeasurementOut"];
export type MeasurementPage = Schemas["MeasurementPage"];
export type DailyPoint = Schemas["DailyPoint"];
export type MonthlyCount = Schemas["MonthlyCount"];
export type StationStats = Schemas["StationStats"];
export type OrangeBaseline = Schemas["OrangeBaselineOut"];
export type OrangeRow = Schemas["OrangeRowOut"];
export type ModelVersion = Schemas["ModelVersionOut"];
export type TrainingRun = Schemas["TrainingRunOut"];
export type UploadOut = Schemas["UploadOut"];
export type UploadDetail = Schemas["UploadDetail"];
export type QueuedOut = Schemas["QueuedOut"];
export type Me = Schemas["MeOut"];

export type Params = Record<string, string | number | boolean | string[] | undefined | null>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function toQuery(params: Params = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    for (const item of Array.isArray(v) ? v : [v]) q.append(k, String(item));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function apiGet<T>(path: string, params?: Params): Promise<T> {
  const res = await fetch(`/api${path}${toQuery(params)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* respons bukan JSON */
    }
    throw new ApiError(res.status, detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail))
      return body.detail.map((d: { msg: string }) => d.msg).join("; ");
  } catch {
    /* respons bukan JSON */
  }
  return res.statusText || `HTTP ${res.status}`;
}

/** POST JSON atau FormData; cookie sesi ikut terkirim (same-origin). */
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: isForm ? undefined : { "content-type": "application/json" },
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function useApi<T>(path: string, params?: Params, enabled = true) {
  return useQuery<T, ApiError>({
    queryKey: [path, params ?? {}],
    queryFn: () => apiGet<T>(path, params),
    enabled,
  });
}
