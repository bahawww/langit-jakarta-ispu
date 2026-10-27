"""Agregat untuk dashboard: harian, bulanan, per stasiun, kondisi terkini."""

from typing import Literal

from fastapi import APIRouter
from sqlalchemy import case, func, select

from app.api.deps import FiltersDep, SessionDep
from app.api.routes import _out
from app.ispu import CATEGORIES, POLLUTANTS, severity
from app.models import Measurement, Station
from app.schemas import DailyPoint, MeasurementOut, MonthlyCount, StationStats

router = APIRouter(prefix="/api/stats")

Series = Literal[tuple([*POLLUTANTS, "max"])]  # type: ignore[valid-type]
_SEVERITY = case({c: i for i, c in enumerate(CATEGORIES)}, value=Measurement.kategori, else_=0)
_UNHEALTHY = [c for c in CATEGORIES if severity(c) >= severity("TIDAK SEHAT")]


@router.get("/daily", response_model=list[DailyPoint])
def daily(
    session: SessionDep, filters: FiltersDep, pollutant: Series = "pm_duakomalima"
) -> list[DailyPoint]:
    """Rata-rata & maksimum antar-stasiun terpilih per hari + kategori terburuk hari itu."""
    col = getattr(Measurement, pollutant)
    stmt = filters.apply(
        select(
            Measurement.tanggal,
            func.avg(col),
            func.max(col),
            func.count(),
            func.max(_SEVERITY),
        )
        .group_by(Measurement.tanggal)
        .order_by(Measurement.tanggal),
        Measurement,
    )
    return [
        DailyPoint(tanggal=t, avg=float(a), max=int(m), stations=n, kategori_terburuk=CATEGORIES[s])
        for t, a, m, n, s in session.execute(stmt)
    ]


@router.get("/monthly", response_model=list[MonthlyCount])
def monthly(session: SessionDep, filters: FiltersDep) -> list[MonthlyCount]:
    bulan = func.to_char(Measurement.tanggal, "YYYY-MM")
    stmt = filters.apply(
        select(bulan, Measurement.kategori, func.count())
        .group_by(bulan, Measurement.kategori)
        .order_by(bulan),
        Measurement,
    )
    out: dict[str, dict[str, int]] = {}
    for b, k, n in session.execute(stmt):
        out.setdefault(b, {})[k] = n
    return [MonthlyCount(bulan=b, counts=c) for b, c in out.items()]


@router.get("/stations", response_model=list[StationStats])
def stations(session: SessionDep, filters: FiltersDep) -> list[StationStats]:
    base = select(
        Station.code,
        Station.name,
        func.count(),
        func.avg(Measurement.pm_duakomalima),
        func.avg(Measurement.pm_sepuluh),
        func.avg(Measurement.max),
        func.avg(case((Measurement.kategori.in_(_UNHEALTHY), 1.0), else_=0.0)),
    ).join(Station, Station.id == Measurement.station_id)
    rows = session.execute(
        filters.apply(base.group_by(Station.id).order_by(Station.code), Measurement)
    ).all()

    def per(col):
        stmt = filters.apply(
            select(Station.code, col, func.count())
            .join(Station, Station.id == Measurement.station_id)
            .where(col.isnot(None))
            .group_by(Station.code, col),
            Measurement,
        )
        acc: dict[str, dict[str, int]] = {}
        for code, k, n in session.execute(stmt):
            acc.setdefault(code, {})[k] = n
        return acc

    kat = per(Measurement.kategori)
    kritis = per(Measurement.parameter_pencemar_kritis)
    return [
        StationStats(
            code=c,
            name=nm,
            rows=n,
            avg_pm_duakomalima=float(p25),
            avg_pm_sepuluh=float(p10),
            avg_max=float(mx),
            pct_tidak_sehat=float(pct),
            by_kategori=dict(sorted(kat.get(c, {}).items(), key=lambda x: severity(x[0]))),
            kritis=dict(sorted(kritis.get(c, {}).items(), key=lambda x: -x[1])),
        )
        for c, nm, n, p25, p10, mx, pct in rows
    ]


@router.get("/latest", response_model=list[MeasurementOut])
def latest(session: SessionDep, filters: FiltersDep) -> list[MeasurementOut]:
    """Pengukuran terakhir tiap stasiun (dalam filter)."""
    last = filters.apply(
        select(Measurement.station_id, func.max(Measurement.tanggal).label("t")).group_by(
            Measurement.station_id
        ),
        Measurement,
    ).subquery()
    stmt = (
        select(Measurement)
        .join(
            last,
            (Measurement.station_id == last.c.station_id) & (Measurement.tanggal == last.c.t),
        )
        .join(Measurement.station)
        .order_by(Station.code)
    )
    return [_out(m) for m in session.scalars(stmt)]
