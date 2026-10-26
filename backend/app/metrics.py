from collections.abc import Sequence

from ispu_ml.metrics import classification_metrics, ordered_labels

from app.schemas import ClassMetrics

__all__ = ["classification_report", "ordered_labels"]


def classification_report(
    y_true: Sequence[str], y_pred: Sequence[str], labels: list[str]
) -> dict[str, object]:
    m = classification_metrics(y_true, y_pred, labels)
    return {
        "correct": m["correct"],
        "accuracy": m["accuracy"],
        "weighted": ClassMetrics(**m["weighted"]),
        "macro": ClassMetrics(**m["macro"]),
        "confusion_matrix": m["confusion_matrix"],
    }
