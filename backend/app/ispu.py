"""Aturan ISPU tinggal di paket ml (satu sumber); modul ini meneruskannya untuk backend."""

from ispu_ml.ispu import CATEGORIES, POLLUTANTS, kategori_from_index, severity

__all__ = ["CATEGORIES", "POLLUTANTS", "kategori_from_index", "severity"]
