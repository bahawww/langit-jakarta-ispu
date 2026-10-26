import csv
import io
from collections.abc import Iterator
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import Integer, case, extract, func, or_, select, text

from app.api.deps import FiltersDep, SessionDep
from app.ispu import CATEGORIES, POLLUTANTS, kategori_from_index, severity
from app.metrics import classification_report, ordered_labels
from app.models import Measurement, OrangeBaseline, Station
from app.schemas import (
    MeasurementOut,
    MeasurementPage,
    MetaOut,
    ModelEval,
    OrangeBaselineOut,
    PollutantOut,
    StationOut,
    SummaryOut,
)

router = APIRouter(prefix="/api")

_SORTABLE = {
    "tanggal": Measurement.tanggal,
    "stasiun": Station.code,
    "max": Measurement.max,
    "kategori": Measurement.kategori,
    **{p: getattr(Measurement, p) for p in POLLUTANTS},
}
_CSV_COLUMNS = [
    "tanggal",
    "station_code",
    "station_name",
    *POLLUTANTS,
    "max",
    "parameter_pencemar_kritis",
    "kategori",
    "kategori_ispu",
    "label_inconsistent",
]


@router.get("/health")
def health(session: SessionDep) -> dict[str, str]:
    session.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/meta", response_model=MetaOut)
def meta(session: SessionDep) -> MetaOut:
    stations = session.execute(
        select(
            Station.code,
            Station.name,
            func.count(Measurement.id),
            func.min(Measurement.tanggal),
            func.max(Measurement.tanggal),
        )
        .outerjoin(Measurement, Measurement.station_id == Station.id)
        .group_by(Station.id)
        .order_by(Station.code)
    ).all()
    year = extract("year", Measurement.tanggal).cast(Integer)
    years = session.scalars(select(year).distinct().order_by(year)).all()
    date_min, date_max, total = session.execute(
        select(func.min(Measurement.tanggal), func.max(Measurement.tanggal), func.count())
    ).one()
    present = session.scalars(select(Measurement.kategori).distinct()).all()
    return MetaOut(
        stations=[
            StationOut(code=c, name=n, rows=r, first_date=f, last_date=lst)
            for c, n, r, f, lst in stations
        ],
        pollutants=[PollutantOut(key=k, label=v) for k, v in POLLUTANTS.items()],
        categories=sorted(present, key=severity),
        years=[int(y) for y in years],
        date_min=date_min,
        date_max=date_max,
        total_rows=total,
    )


@router.get("/stats/summary", response_model=SummaryOut)
def summary(session: SessionDep, filters: FiltersDep) -> SummaryOut:
    unhealthy = [c for c in CATEGORIES if severity(c) >= severity("TIDAK SEHAT")]
    stmt = filters.apply(
        select(
            func.count(),
            func.avg(Measurement.pm_duakomalima),
            func.avg(Measurement.pm_sepuluh),
            func.avg(case((Measurement.kategori.in_(unhealthy), 1.0), else_=0.0)),
            func.count().filter(Measurement.label_inconsistent),
        ),
        Measurement,
    )
    rows, pm25, pm10, pct, inconsistent = session.execute(stmt).one()
    by_kat = session.execute(
        filters.apply(
            select(Measurement.kategori, func.count()).group_by(Measurement.kategori), Measurement
        )
    ).all()
    return SummaryOut(
        rows=rows,
        avg_pm_duakomalima=float(pm25) if pm25 is not None else None,
        avg_pm_sepuluh=float(pm10) if pm10 is not None else None,
        pct_tidak_sehat=float(pct) if pct is not None else None,
        by_kategori={k: n for k, n in sorted(by_kat, key=lambda x: severity(x[0]))},
        label_inconsistent=inconsistent,
    )


def _measurement_query(
    filters: FiltersDep, kategori: list[str] | None, inconsistent: bool | None, q: str | None
):
    stmt = filters.apply(select(Measurement).join(Measurement.station), Measurement)
    if kategori:
        stmt = stmt.where(Measurement.kategori.in_(kategori))
    if inconsistent is not None:
        stmt = stmt.where(Measurement.label_inconsistent.is_(inconsistent))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Station.name.ilike(like),
                Station.code.ilike(like),
                Measurement.kategori.ilike(like),
                Measurement.parameter_pencemar_kritis.ilike(like),
            )
        )
    return stmt


def _out(m: Measurement) -> MeasurementOut:
    return MeasurementOut(
        tanggal=m.tanggal,
        station_code=m.station.code,
        station_name=m.station.name,
        **{p: getattr(m, p) for p in POLLUTANTS},
        max=m.max,
        parameter_pencemar_kritis=m.parameter_pencemar_kritis,
        kategori=m.kategori,
        kategori_ispu=m.kategori_ispu,
        label_inconsistent=m.label_inconsistent,
    )


@router.get("/measurements", response_model=MeasurementPage)
def measurements(
    session: SessionDep,
    filters: FiltersDep,
    kategori: Annotated[list[str] | None, Query()] = None,
    inconsistent: bool | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: Literal[tuple(_SORTABLE)] = "tanggal",  # type: ignore[valid-type]
    order: Literal["asc", "desc"] = "desc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=500)] = 50,
) -> MeasurementPage:
    stmt = _measurement_query(filters, kategori, inconsistent, q)
    total = session.scalar(select(func.count()).select_from(stmt.subquery()))
    col = _SORTABLE[sort]
    stmt = stmt.order_by(col.asc() if order == "asc" else col.desc(), Measurement.id)
    items = session.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return MeasurementPage(
        items=[_out(m) for m in items], total=total or 0, page=page, page_size=page_size
    )


@router.get("/measurements.csv")
def measurements_csv(
    session: SessionDep,
    filters: FiltersDep,
    kategori: Annotated[list[str] | None, Query()] = None,
    inconsistent: bool | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> StreamingResponse:
    stmt = _measurement_query(filters, kategori, inconsistent, q).order_by(
        Measurement.tanggal, Station.code
    )
    rows = [_out(m).model_dump() for m in session.scalars(stmt)]

    def generate() -> Iterator[str]:
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=_CSV_COLUMNS)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
            if buf.tell() > 64_000:
                yield buf.getvalue()
                buf.seek(0)
                buf.truncate()
        yield buf.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="ispu_dki_jakarta.csv"'},
    )


@router.get("/baseline/orange", response_model=OrangeBaselineOut)
def orange_baseline(session: SessionDep, filters: FiltersDep) -> OrangeBaselineOut:
    rows = session.scalars(filters.apply(select(OrangeBaseline), OrangeBaseline)).all()
    y_true = [r.kategori for r in rows]
    y_ispu = [kategori_from_index(r.max) for r in rows]
    preds = {
        "Random Forest": [r.pred_random_forest for r in rows],
        "Decision Tree": [r.pred_decision_tree for r in rows],
        "kNN": [r.pred_knn for r in rows],
    }
    labels = ordered_labels(y_true, *preds.values())
    models = []
    for name, y_pred in preds.items():
        rep = classification_report(y_true, y_pred, labels)
        correct_ispu = sum(a == b for a, b in zip(y_ispu, y_pred, strict=True))
        models.append(
            ModelEval(
                model=name,
                **rep,
                correct_vs_ispu=correct_ispu,
                accuracy_vs_ispu=correct_ispu / len(rows) if rows else 0.0,
            )
        )
    n = len(rows)
    return OrangeBaselineOut(
        rows=n,
        labels=labels,
        avg_pm_duakomalima=sum(r.pm_duakomalima for r in rows) / n if n else None,
        avg_pm_sepuluh=sum(r.pm_sepuluh for r in rows) / n if n else None,
        label_inconsistent=sum(a != b for a, b in zip(y_true, y_ispu, strict=True)),
        models=models,
    )
