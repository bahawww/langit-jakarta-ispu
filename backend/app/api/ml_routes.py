"""Endpoint baca untuk registry model, riwayat training, dan forecast."""

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.deps import SessionDep
from app.ispu import severity
from app.models import Forecast, ModelVersion, Station, TrainingRun
from app.schemas import ForecastDay, ForecastOut, ModelVersionOut, TrainingRunOut

router = APIRouter(prefix="/api")
Task = Literal["classification", "forecast"]
_UNHEALTHY = severity("TIDAK SEHAT")


def _mv(m: ModelVersion, with_metrics: bool) -> ModelVersionOut:
    out = ModelVersionOut.model_validate(m, from_attributes=True)
    if not with_metrics:
        out.metrics = None
    return out


@router.get("/models", response_model=list[ModelVersionOut])
def list_models(session: SessionDep, task: Task | None = None) -> list[ModelVersionOut]:
    stmt = select(ModelVersion).order_by(ModelVersion.task, ModelVersion.version.desc())
    if task:
        stmt = stmt.where(ModelVersion.task == task)
    return [_mv(m, with_metrics=False) for m in session.scalars(stmt)]


@router.get("/models/champions", response_model=dict[str, ModelVersionOut | None])
def champions(session: SessionDep) -> dict[str, ModelVersionOut | None]:
    rows = {
        m.task: m
        for m in session.scalars(select(ModelVersion).where(ModelVersion.status == "champion"))
    }
    return {t: (_mv(rows[t], True) if t in rows else None) for t in ("classification", "forecast")}


@router.get("/models/{model_id}", response_model=ModelVersionOut)
def get_model(session: SessionDep, model_id: int) -> ModelVersionOut:
    m = session.get(ModelVersion, model_id)
    if m is None:
        raise HTTPException(404, "model tidak ditemukan")
    return _mv(m, with_metrics=True)


@router.get("/training-runs", response_model=list[TrainingRunOut])
def training_runs(
    session: SessionDep, limit: Annotated[int, Query(ge=1, le=200)] = 20
) -> list[TrainingRunOut]:
    stmt = select(TrainingRun).order_by(TrainingRun.id.desc()).limit(limit)
    return [TrainingRunOut.model_validate(r, from_attributes=True) for r in session.scalars(stmt)]


@router.get("/forecast", response_model=ForecastOut)
def get_forecast(
    session: SessionDep,
    station: Annotated[list[str] | None, Query(description="Kode stasiun")] = None,
) -> ForecastOut:
    stmt = select(Forecast).join(Forecast.station).order_by(Station.code, Forecast.horizon)
    if station:
        stmt = stmt.where(Station.code.in_(station))
    rows = session.scalars(stmt).all()
    mv = session.get(ModelVersion, rows[0].model_version_id) if rows else None
    return ForecastOut(
        model_version_id=mv.id if mv else None,
        model_version=mv.version if mv else None,
        generated_at=max(r.created_at for r in rows) if rows else None,
        interval=mv.metrics.get("interval") if mv else None,
        items=[
            ForecastDay(
                station_code=r.station.code,
                station_name=r.station.name,
                origin_date=r.origin_date,
                target_date=r.target_date,
                horizon=r.horizon,
                kategori=r.kategori,
                kategori_upper=r.kategori_upper,
                critical=r.critical,
                max_yhat=r.max_yhat,
                alert=severity(r.kategori) >= _UNHEALTHY,
                alert_possible=severity(r.kategori_upper) >= _UNHEALTHY,
                values=r.values,
            )
            for r in rows
        ],
    )
