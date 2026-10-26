"""Parse CSV ISPU (format mentah Satu Data atau format bersih) tanpa menyentuh database."""

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date

from app.ispu import CATEGORIES, POLLUTANTS, kategori_from_index

NA_TOKENS = {"", "N/A", "NA", "-", "TIDAK ADA DATA", "NULL", "NAN"}
_STATION_CODE = re.compile(r"\bDKI\s*(\d+)\b", re.IGNORECASE)
_REQUIRED = {"stasiun", *POLLUTANTS, "max", "kategori"}


class SchemaError(ValueError):
    """Header CSV tidak sesuai format mentah maupun bersih."""


@dataclass
class ParsedRow:
    line: int
    tanggal: date
    station_code: str
    station_name: str
    values: dict[str, int]
    max: int
    parameter_pencemar_kritis: str | None
    kategori: str
    raw: dict[str, str] = field(repr=False)

    @property
    def kategori_ispu(self) -> str:
        return kategori_from_index(self.max)

    @property
    def label_inconsistent(self) -> bool:
        return self.kategori != self.kategori_ispu


@dataclass
class ParseResult:
    format: str
    total: int
    rows: list[ParsedRow]
    rejected: list[dict[str, object]]


def normalize_station(name: str) -> tuple[str, str]:
    """'DKI1  Bunderan HI' -> ('DKI1', 'DKI1 Bunderan HI'). ValueError jika tidak ada kode DKIn."""
    clean = " ".join(name.split())
    m = _STATION_CODE.search(clean)
    if not m:
        raise ValueError(f"stasiun tidak dikenali: {clean!r}")
    return f"DKI{int(m.group(1))}", clean


def _int(raw: str, column: str) -> int:
    s = raw.strip()
    if s.upper() in NA_TOKENS:
        raise ValueError(f"nilai kosong/N/A di kolom {column}")
    try:
        f = float(s.replace(",", "."))
    except ValueError:
        raise ValueError(f"bukan angka di kolom {column}: {s!r}") from None
    if not f.is_integer() or f < 0:
        raise ValueError(f"nilai indeks harus bilangan bulat >= 0 di kolom {column}: {s!r}")
    return int(f)


def _date(row: dict[str, str], fmt: str) -> date:
    try:
        if fmt == "clean":
            return date.fromisoformat(row["tanggal_lengkap"].strip())
        periode = row["periode_data"].strip()
        return date(int(periode[:4]), int(periode[4:6]), int(row["tanggal"].strip()))
    except (ValueError, IndexError):
        raise ValueError("tanggal tidak valid") from None


def parse_csv(data: bytes) -> ParseResult:
    # File mentah Satu Data membawa BOM UTF-8 ganda; buang semuanya.
    text = data.decode("utf-8-sig").lstrip("﻿")
    reader = csv.DictReader(io.StringIO(text))
    header = {(h or "").strip().lower() for h in reader.fieldnames or []}
    missing = _REQUIRED - header
    if "tanggal_lengkap" in header:
        fmt = "clean"
    elif {"periode_data", "tanggal"} <= header:
        fmt = "raw"
    else:
        missing |= {"tanggal_lengkap (atau periode_data + tanggal)"}
        fmt = "unknown"
    if missing:
        raise SchemaError(f"kolom wajib tidak ada: {', '.join(sorted(missing))}")

    rows: list[ParsedRow] = []
    rejected: list[dict[str, object]] = []
    seen: dict[tuple[date, str], int] = {}
    total = 0
    for i, raw_row in enumerate(reader, start=2):
        total += 1
        row = {(k or "").strip().lower(): (v or "") for k, v in raw_row.items()}
        try:
            tanggal = _date(row, fmt)
            code, name = normalize_station(row["stasiun"])
            values = {col: _int(row[col], col) for col in POLLUTANTS}
            max_value = _int(row["max"], "max")
            if max_value != max(values.values()):
                raise ValueError(
                    f"max ({max_value}) tidak sama dengan nilai polutan tertinggi "
                    f"({max(values.values())})"
                )
            kategori = " ".join(row["kategori"].split()).upper()
            if kategori not in CATEGORIES:
                raise ValueError(f"kategori tidak valid: {row['kategori'].strip()!r}")
            if (tanggal, code) in seen:
                raise ValueError(
                    f"duplikat (tanggal, stasiun) dengan baris {seen[(tanggal, code)]}"
                )
        except ValueError as e:
            rejected.append({"line": i, "reason": str(e)})
            continue
        seen[(tanggal, code)] = i
        kritis = row.get("parameter_pencemar_kritis", "").strip()
        rows.append(
            ParsedRow(
                line=i,
                tanggal=tanggal,
                station_code=code,
                station_name=name,
                values=values,
                max=max_value,
                parameter_pencemar_kritis=None if kritis.upper() in NA_TOKENS else kritis,
                kategori=kategori,
                raw=row,
            )
        )
    return ParseResult(format=fmt, total=total, rows=rows, rejected=rejected)
