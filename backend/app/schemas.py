from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class StationOut(BaseModel):
    code: str
    name: str
    rows: int
    first_date: date | None
    last_date: date | None


class PollutantOut(BaseModel):
    key: str
    label: str


class MetaOut(BaseModel):
    stations: list[StationOut]
    pollutants: list[PollutantOut]
    categories: list[str]
    years: list[int]
    date_min: date | None
    date_max: date | None
    total_rows: int


class SummaryOut(BaseModel):
    rows: int
    avg_pm_duakomalima: float | None
    avg_pm_sepuluh: float | None
    pct_tidak_sehat: float | None
    by_kategori: dict[str, int]
    label_inconsistent: int


class MeasurementOut(BaseModel):
    tanggal: date
    station_code: str
    station_name: str
    pm_sepuluh: int
    pm_duakomalima: int
    sulfur_dioksida: int
    karbon_monoksida: int
    ozon: int
    nitrogen_dioksida: int
    max: int
    parameter_pencemar_kritis: str | None
    kategori: str
    kategori_ispu: str
    label_inconsistent: bool


class MeasurementPage(BaseModel):
    items: list[MeasurementOut]
    total: int
    page: int
    page_size: int


class ClassMetrics(BaseModel):
    precision: float
    recall: float
    f1: float


class ModelEval(BaseModel):
    model: str
    correct: int
    accuracy: float
    weighted: ClassMetrics
    macro: ClassMetrics
    confusion_matrix: list[list[int]]
    correct_vs_ispu: int
    accuracy_vs_ispu: float


class OrangeBaselineOut(BaseModel):
    rows: int
    labels: list[str]
    avg_pm_duakomalima: float | None
    avg_pm_sepuluh: float | None
    label_inconsistent: int
    models: list[ModelEval]


class ModelVersionOut(BaseModel):
    id: int
    task: str
    version: int
    status: str
    algorithm: str
    ml_version: str
    created_at: datetime
    promoted_at: datetime | None
    train_start: date
    train_end: date
    data_end: date
    n_rows: int
    primary_metric: str
    primary_value: float
    snapshot_hash: str
    training_run_id: int | None
    params: dict[str, Any]
    metrics: dict[str, Any] | None = None


class TrainingRunOut(BaseModel):
    id: int
    created_at: datetime
    finished_at: datetime | None
    trigger: str
    status: str
    upload_id: int | None
    snapshot_hash: str | None
    message: str | None
    details: dict[str, Any]


class PollutantForecast(BaseModel):
    yhat: float
    lo: float
    hi: float


class ForecastDay(BaseModel):
    station_code: str
    station_name: str
    origin_date: date
    target_date: date
    horizon: int
    kategori: str
    kategori_upper: str
    critical: str
    max_yhat: float
    alert: bool
    alert_possible: bool
    values: dict[str, PollutantForecast]


class ForecastOut(BaseModel):
    model_version_id: int | None
    model_version: int | None
    generated_at: datetime | None
    interval: list[float] | None
    items: list[ForecastDay]
