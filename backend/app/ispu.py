"""Aturan ISPU: nama polutan dan ambang kategori (nilai indeks, bukan konsentrasi)."""

import math

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


def severity(kategori: str) -> int:
    return CATEGORIES.index(kategori)
