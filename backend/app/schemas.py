from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


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


class OrangeRowOut(BaseModel):
    tanggal: date
    station_code: str
    station_name: str
    pm_duakomalima: int
    pm_sepuluh: int
    kategori: str
    pred_random_forest: str
    pred_decision_tree: str
    pred_knn: str


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


class DailyPoint(BaseModel):
    tanggal: date
    avg: float
    max: int
    stations: int
    kategori_terburuk: str


class MonthlyCount(BaseModel):
    bulan: str
    counts: dict[str, int]


class StationStats(BaseModel):
    code: str
    name: str
    rows: int
    avg_pm_duakomalima: float
    avg_pm_sepuluh: float
    avg_max: float  # rata-rata indeks tertinggi harian (penentu kategori)
    pct_tidak_sehat: float
    by_kategori: dict[str, int]
    kritis: dict[str, int]


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class MeOut(BaseModel):
    username: str


class RejectedRow(BaseModel):
    line: int
    reason: str


class UploadOut(BaseModel):
    id: int
    created_at: datetime
    filename: str
    source: str
    format: str | None
    status: str
    total_rows: int
    inserted: int
    updated: int
    unchanged: int
    rejected: int
    error: str | None
    retrain_queued: bool | None = None


class UploadDetail(UploadOut):
    rejected_details: list[RejectedRow]


class QueuedOut(BaseModel):
    queued: bool
    task_id: str | None
    message: str


class SimulateIn(BaseModel):
    """Nilai indeks ISPU enam polutan pada satu hari (bukan konsentrasi)."""

    pm_sepuluh: int = Field(ge=0, le=500)
    pm_duakomalima: int = Field(ge=0, le=500)
    sulfur_dioksida: int = Field(ge=0, le=500)
    karbon_monoksida: int = Field(ge=0, le=500)
    ozon: int = Field(ge=0, le=500)
    nitrogen_dioksida: int = Field(ge=0, le=500)


class SimulateModel(BaseModel):
    label: str
    probabilities: dict[str, float]


class SimulateOut(BaseModel):
    models: dict[str, SimulateModel]
    ispu_category: str  # kategori resmi dari nilai tertinggi (definisi label, bukan model)
