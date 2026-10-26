"""Bentuk DataFrame yang dipakai semua model + pembagian waktu holdout."""

import hashlib

import pandas as pd

from ispu_ml.ispu import POLLUTANTS

COLUMNS = ["tanggal", "station", *POLLUTANTS, "max", "kategori", "kategori_ispu"]


def normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Urutan kolom/baris kanonik supaya hash snapshot stabil."""
    out = df[COLUMNS].copy()
    out["tanggal"] = pd.to_datetime(out["tanggal"])
    return out.sort_values(["tanggal", "station"]).reset_index(drop=True)


def snapshot_bytes(df: pd.DataFrame) -> bytes:
    return normalize_frame(df).to_csv(index=False, date_format="%Y-%m-%d").encode()


def snapshot_hash(df: pd.DataFrame) -> str:
    return hashlib.sha256(snapshot_bytes(df)).hexdigest()


def holdout_cutoff(dates: pd.Series, fraction: float = 0.2) -> pd.Timestamp:
    """Tanggal terakhir data latih: 20% tanggal unik terakhir menjadi holdout."""
    unique = pd.Series(pd.to_datetime(dates).unique()).sort_values().reset_index(drop=True)
    n_train = max(1, int(round(len(unique) * (1 - fraction))))
    return unique.iloc[n_train - 1]
