"""Endpoint baca untuk registry model dan riwayat training."""

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.deps import SessionDep
from app.models import ModelVersion, TrainingRun
from app.schemas import ModelVersionOut, TrainingRunOut

router = APIRouter(prefix="/api")
Task = Literal["classification"]


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
    return {t: (_mv(rows[t], True) if t in rows else None) for t in ("classification",)}


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
