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
export type ModelVersion = Schemas["ModelVersionOut"];
export type TrainingRun = Schemas["TrainingRunOut"];
export type ForecastOut = Schemas["ForecastOut"];
export type ForecastDay = Schemas["ForecastDay"];

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

export function useApi<T>(path: string, params?: Params, enabled = true) {
  return useQuery<T, ApiError>({
    queryKey: [path, params ?? {}],
    queryFn: () => apiGet<T>(path, params),
    enabled,
  });
}
