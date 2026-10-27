"""Analisis model (importance, kurva, cross-validation, ...) dan simulator tebakan kategori."""

import pandas as pd
from fastapi import APIRouter, HTTPException
from ispu_ml.classification import FEATURES
from ispu_ml.ispu import kategori_from_index

from app import analysis
from app.schemas import SimulateIn, SimulateModel, SimulateOut

router = APIRouter(prefix="/api")


@router.get("/analysis")
def get_analysis() -> dict:
    data = analysis.load()
    if data is None:
        raise HTTPException(503, "Analisis model belum tersedia; tunggu training selesai.")
    return data


@router.post("/simulate", response_model=SimulateOut)
def simulate(body: SimulateIn) -> SimulateOut:
    fitted = analysis.models()
    if fitted is None:
        raise HTTPException(503, "Model belum tersedia; tunggu training selesai.")
    row = [[getattr(body, f) for f in FEATURES]]
    x = pd.DataFrame(row, columns=FEATURES)
    out: dict[str, SimulateModel] = {}
    for name, model in fitted.items():
        proba = model.predict_proba(x)[0]
        probs = {c: round(float(p), 4) for c, p in zip(model.classes_, proba, strict=True)}
        out[name] = SimulateModel(label=max(probs, key=probs.get), probabilities=probs)
    return SimulateOut(models=out, ispu_category=kategori_from_index(max(row[0])))
