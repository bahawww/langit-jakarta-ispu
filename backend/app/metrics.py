from collections.abc import Sequence

from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support

from app.ispu import severity
from app.schemas import ClassMetrics


def ordered_labels(*columns: Sequence[str]) -> list[str]:
    """Kelas yang muncul di data, diurutkan menurut tingkat keparahan ISPU."""
    return sorted({v for col in columns for v in col}, key=severity)


def classification_report(
    y_true: Sequence[str], y_pred: Sequence[str], labels: list[str]
) -> dict[str, object]:
    def avg(kind: str) -> ClassMetrics:
        p, r, f, _ = precision_recall_fscore_support(
            y_true, y_pred, labels=labels, average=kind, zero_division=0
        )
        return ClassMetrics(precision=float(p), recall=float(r), f1=float(f))

    return {
        "correct": sum(t == p for t, p in zip(y_true, y_pred, strict=True)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "weighted": avg("weighted"),
        "macro": avg("macro"),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }
