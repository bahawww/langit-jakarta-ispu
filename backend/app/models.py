from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(200))


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    filename: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(16))  # seed | admin
    format: Mapped[str | None] = mapped_column(String(16))  # raw | clean
    status: Mapped[str] = mapped_column(String(16))  # processing | success | failed
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    inserted: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    unchanged: Mapped[int] = mapped_column(Integer, default=0)
    rejected: Mapped[int] = mapped_column(Integer, default=0)
    rejected_details: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    error: Mapped[str | None] = mapped_column(String(1000))


class _PollutantColumns:
    pm_sepuluh: Mapped[int] = mapped_column(SmallInteger)
    pm_duakomalima: Mapped[int] = mapped_column(SmallInteger)
    sulfur_dioksida: Mapped[int] = mapped_column(SmallInteger)
    karbon_monoksida: Mapped[int] = mapped_column(SmallInteger)
    ozon: Mapped[int] = mapped_column(SmallInteger)
    nitrogen_dioksida: Mapped[int] = mapped_column(SmallInteger)
    max: Mapped[int] = mapped_column(SmallInteger)
    parameter_pencemar_kritis: Mapped[str | None] = mapped_column(String(32))
    kategori: Mapped[str] = mapped_column(String(32))  # label sumber
    kategori_ispu: Mapped[str] = mapped_column(String(32))  # turunan dari max


class Measurement(_PollutantColumns, Base):
    __tablename__ = "measurements"
    __table_args__ = (UniqueConstraint("tanggal", "station_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"))
    label_inconsistent: Mapped[bool] = mapped_column(Boolean, index=True)
    upload_id: Mapped[int | None] = mapped_column(ForeignKey("uploads.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    station: Mapped[Station] = relationship(lazy="joined")


class OrangeBaseline(_PollutantColumns, Base):
    """Data uji 20% dan prediksi dari Orange Data Mining, disimpan apa adanya."""

    __tablename__ = "orange_baseline"
    __table_args__ = (UniqueConstraint("tanggal", "station_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tanggal: Mapped[date] = mapped_column(Date)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"))
    pred_random_forest: Mapped[str] = mapped_column(String(32))
    pred_decision_tree: Mapped[str] = mapped_column(String(32))
    pred_knn: Mapped[str] = mapped_column(String(32))

    station: Mapped[Station] = relationship(lazy="joined")
