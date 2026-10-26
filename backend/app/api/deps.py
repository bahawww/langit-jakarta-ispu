from dataclasses import dataclass
from datetime import date
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Query
from sqlalchemy import Select, extract, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Station

SessionDep = Annotated[Session, Depends(get_session)]


@dataclass
class Filters:
    station: list[str] | None
    start: date | None
    end: date | None
    year: int | None

    def apply(self, stmt: Select[Any], model: Any) -> Select[Any]:
        if self.station:
            ids = select(Station.id).where(Station.code.in_(self.station))
            stmt = stmt.where(model.station_id.in_(ids))
        if self.start:
            stmt = stmt.where(model.tanggal >= self.start)
        if self.end:
            stmt = stmt.where(model.tanggal <= self.end)
        if self.year:
            stmt = stmt.where(extract("year", model.tanggal) == self.year)
        return stmt


def get_filters(
    station: Annotated[list[str] | None, Query(description="Kode stasiun, mis. DKI1")] = None,
    start: date | None = None,
    end: date | None = None,
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
) -> Filters:
    if start and end and start > end:
        raise HTTPException(422, "start harus <= end")
    return Filters(station=station, start=start, end=end, year=year)


FiltersDep = Annotated[Filters, Depends(get_filters)]
