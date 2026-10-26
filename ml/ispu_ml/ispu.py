"""Aturan ISPU: nama polutan dan ambang kategori (nilai indeks, bukan konsentrasi)."""

import math

import numpy as np

POLLUTANTS: dict[str, str] = {
    "pm_sepuluh": "PM10",
    "pm_duakomalima": "PM2.5",
    "sulfur_dioksida": "SO2",
    "karbon_monoksida": "CO",
    "ozon": "O3",
    "nitrogen_dioksida": "NO2",
}

# Urutan = tingkat keparahan; batas atas inklusif tiap kategori.
CATEGORIES: tuple[str, ...] = (
    "BAIK",
    "SEDANG",
    "TIDAK SEHAT",
    "SANGAT TIDAK SEHAT",
    "BERBAHAYA",
)
_UPPER_BOUNDS = (50, 100, 200, 300)


def kategori_from_index(value: float) -> str:
    v = math.floor(value + 0.5)
    for name, upper in zip(CATEGORIES, _UPPER_BOUNDS, strict=False):
        if v <= upper:
            return name
    return CATEGORIES[-1]


def kategori_array(values: np.ndarray) -> np.ndarray:
    v = np.floor(np.asarray(values, dtype=float) + 0.5)
    idx = np.searchsorted(np.array(_UPPER_BOUNDS), v, side="left")
    return np.array(CATEGORIES, dtype=object)[idx]


def severity(kategori: str) -> int:
    return CATEGORIES.index(kategori)
