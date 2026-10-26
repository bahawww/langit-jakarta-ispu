from collections.abc import Sequence

import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support

from ispu_ml.ispu import severity


def ordered_labels(*columns: Sequence[str]) -> list[str]:
    """Kelas yang muncul di data, diurutkan menurut tingkat keparahan ISPU."""
    return sorted({v for col in columns for v in col}, key=severity)


def classification_metrics(
    y_true: Sequence[str], y_pred: Sequence[str], labels: list[str] | None = None
) -> dict:
    y_true, y_pred = list(y_true), list(y_pred)
    labels = labels or ordered_labels(y_true, y_pred)

    def avg(kind: str) -> dict[str, float]:
        p, r, f, _ = precision_recall_fscore_support(
            y_true, y_pred, labels=labels, average=kind, zero_division=0
        )
        return {"precision": float(p), "recall": float(r), "f1": float(f)}

    return {
        "n": len(y_true),
        "labels": labels,
        "correct": int(sum(t == p for t, p in zip(y_true, y_pred, strict=True))),
        "accuracy": float(accuracy_score(y_true, y_pred)) if y_true else 0.0,
        "weighted": avg("weighted"),
        "macro": avg("macro"),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    err = np.asarray(y_pred, dtype=float) - np.asarray(y_true, dtype=float)
    return {
        "n": int(err.size),
        "mae": float(np.mean(np.abs(err))) if err.size else float("nan"),
        "rmse": float(np.sqrt(np.mean(err**2))) if err.size else float("nan"),
    }
