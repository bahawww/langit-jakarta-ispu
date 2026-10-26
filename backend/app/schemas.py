from datetime import date

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
