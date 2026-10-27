"""Analisis model dasar untuk halaman Ringkasan, Evaluasi, Penjelasan, dan Simulator.

Semua model tetap bawaan scikit-learn (Decision Tree, Random Forest, kNN k=5). Grid jumlah pohon dan
kedalaman, serta kurva kedalaman, hanya bahan analisis: model yang dipakai tidak diganti olehnya.
"""

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import partial_dependence, permutation_importance
from sklearn.metrics import (
    accuracy_score,
    auc,
    average_precision_score,
    f1_score,
    precision_recall_curve,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, learning_curve
from sklearn.tree import DecisionTreeClassifier

from ispu_ml.classification import FEATURES, TARGET, candidates, strata_of, stratified_split
from ispu_ml.ispu import POLLUTANTS, severity

ANALYSIS_VERSION = 3
FOCUS = "TIDAK SEHAT"  # kelas yang paling menentukan bagi pembaca (peringatan udara tidak sehat)
GRID_TREES = [50, 100, 200, 400]
GRID_DEPTH = [5, 10, 20, None]
DEFAULT_TREES, DEFAULT_DEPTH = 100, None  # bawaan sklearn
POINTS = 4  # desimal pada keluaran, supaya JSON kecil


def _r(x) -> float:
    return round(float(x), POINTS)


def _rl(xs) -> list[float]:
    return [_r(x) for x in xs]


def _label(name: str) -> str:
    return POLLUTANTS.get(name, name)


def _importance(model: BaseEstimator, x: pd.DataFrame, y: pd.Series, seed: int) -> dict[str, float]:
    """Permutation importance (penurunan akurasi saat satu fitur diacak), dinormalkan jadi porsi."""
    imp = permutation_importance(model, x, y, n_repeats=5, random_state=seed, scoring="accuracy")
    mean = np.clip(imp.importances_mean, 0, None)
    total = mean.sum()
    share = mean / total if total > 0 else mean
    return {f: _r(v) for f, v in zip(FEATURES, share, strict=True)}


def _roc_pr(model: BaseEstimator, x: pd.DataFrame, y: pd.Series) -> tuple[dict, dict | None]:
    """ROC rata-rata makro (satu-lawan-sisa per kelas) dan PR kelas FOCUS."""
    proba = model.predict_proba(x)
    classes = list(model.classes_)
    grid = np.linspace(0, 1, 41)
    tprs, aucs = [], []
    pr = None
    for i, c in enumerate(classes):
        pos = (y == c).to_numpy()
        if pos.sum() == 0 or pos.sum() == len(pos):
            continue
        fpr, tpr, _ = roc_curve(pos, proba[:, i])
        tprs.append(np.interp(grid, fpr, tpr))
        aucs.append(auc(fpr, tpr))
        if c == FOCUS:
            prec, rec, _ = precision_recall_curve(pos, proba[:, i])
            rg = np.linspace(0, 1, 41)
            # presisi tertinggi yang masih mencapai recall tersebut (kurva PR yang rapi)
            p_at = [prec[rec >= r].max() if (rec >= r).any() else 0.0 for r in rg]
            ap = average_precision_score(pos, proba[:, i])
            pr = {"ap": _r(ap), "recall": _rl(rg), "precision": _rl(p_at)}
    mean_tpr = np.mean(tprs, axis=0)
    mean_tpr[0] = 0.0
    roc = {"auc": _r(np.mean(aucs)), "fpr": _rl(grid), "tpr": _rl(mean_tpr)}
    return roc, pr


def _tree_nodes(tree: DecisionTreeClassifier, classes: list[str], depth: int = 2) -> dict:
    t = tree.tree_

    def node(i: int, d: int) -> dict:
        counts = t.value[i][0]
        out = {
            "n": int(t.n_node_samples[i]),
            "label": classes[int(np.argmax(counts))],
            "leaf": bool(t.children_left[i] == -1),
        }
        if not out["leaf"] and d < depth:
            out["feature"] = FEATURES[int(t.feature[i])]
            out["threshold"] = _r(t.threshold[i])
            out["children"] = [
                node(int(t.children_left[i]), d + 1),
                node(int(t.children_right[i]), d + 1),
            ]
        return out

    root = node(0, 0)
    root["depth"] = int(t.max_depth)
    return root


def analyze(df: pd.DataFrame, seed: int = 42) -> tuple[dict, dict[str, BaseEstimator]]:
    """Hitung semua bahan analisis.

    Mengembalikan (hasil JSON-aman, tiga model yang dilatih ulang pada semua data).
    """
    train, test = stratified_split(df, seed)
    x_tr, y_tr, x_te, y_te = train[FEATURES], train[TARGET], test[FEATURES], test[TARGET]
    models = {n: clone(m).fit(x_tr, y_tr) for n, m in candidates(seed).items()}
    labels = sorted(set(df[TARGET]), key=severity)

    counts = y_te.value_counts()
    majority = counts.idxmax()
    p = counts / counts.sum()
    out: dict = {
        "version": ANALYSIS_VERSION,
        "n_train": len(train),
        "n_test": len(test),
        "labels": labels,
        "focus": FOCUS,
        "features": {f: _label(f) for f in FEATURES},
        "baselines": {
            "majority": {"label": majority, "accuracy": _r((y_te == majority).mean())},
            "random": {"accuracy": _r((p**2).sum())},
        },
    }

    out["test_accuracy"] = {n: _r(accuracy_score(y_te, m.predict(x_te))) for n, m in models.items()}
    # contoh hari nyata untuk Simulator: median tiap polutan per kategori, dan batas atas data
    out["presets"] = {
        c: {f: int(g[f].median()) for f in FEATURES} for c, g in df.groupby(TARGET) if len(g) >= 20
    }
    out["ranges"] = {f: int(df[f].max()) for f in FEATURES}

    out["importance"] = {n: _importance(m, x_te, y_te, seed) for n, m in models.items()}

    out["roc"], out["pr"] = {}, {"label": FOCUS}
    for n, m in models.items():
        roc, pr = _roc_pr(m, x_te, y_te)
        out["roc"][n] = roc
        if pr:
            out["pr"][n] = pr

    # Validasi silang 5 lipatan pada semua data (stratifikasi dengan kelas langka digabung).
    skf = StratifiedKFold(5, shuffle=True, random_state=seed)
    folds = list(skf.split(df[FEATURES], strata_of(df, min_count=5)))
    out["cv"], out["learning"] = {}, {}
    sizes = None
    for n, est in candidates(seed).items():
        r = cross_validate(
            est, df[FEATURES], df[TARGET], cv=folds, scoring=["accuracy", "f1_macro"], n_jobs=1
        )
        out["cv"][n] = {"accuracy": _rl(r["test_accuracy"]), "macro_f1": _rl(r["test_f1_macro"])}
        sz, tr_s, va_s = learning_curve(
            est, df[FEATURES], df[TARGET], cv=folds, train_sizes=np.linspace(0.2, 1.0, 5),
            scoring="accuracy", n_jobs=1,
        )  # fmt: skip
        sizes = sz
        out["learning"][n] = {"train": _rl(tr_s.mean(axis=1)), "val": _rl(va_s.mean(axis=1))}
    out["learning"]["sizes"] = [int(s) for s in sizes]

    # Kedalaman Decision Tree (analisis): akurasi data latih vs data uji.
    depths = list(range(1, 21))
    d_tr, d_te = [], []
    for d in depths:
        dt = DecisionTreeClassifier(max_depth=d, random_state=seed).fit(x_tr, y_tr)
        d_tr.append(accuracy_score(y_tr, dt.predict(x_tr)))
        d_te.append(accuracy_score(y_te, dt.predict(x_te)))
    out["depth"] = {"depth": depths, "train": _rl(d_tr), "test": _rl(d_te)}

    # Grid Random Forest (analisis): F1 makro pada data uji untuk tiap kombinasi.
    grid = []
    for depth in GRID_DEPTH:
        row = []
        for trees in GRID_TREES:
            rf = RandomForestClassifier(
                n_estimators=trees, max_depth=depth, random_state=seed, n_jobs=4
            ).fit(x_tr, y_tr)
            row.append(f1_score(y_te, rf.predict(x_te), average="macro", zero_division=0))
        grid.append(_rl(row))
    out["grid"] = {
        "n_estimators": GRID_TREES,
        "max_depth": GRID_DEPTH,
        "f1": grid,
        "default": {"n_estimators": DEFAULT_TREES, "max_depth": DEFAULT_DEPTH},
    }

    out["tree"] = _tree_nodes(models["decision_tree"], list(models["decision_tree"].classes_))

    # Partial dependence Random Forest: peluang kelas FOCUS bila satu polutan diubah.
    rf = models["random_forest"]
    pdp: dict = {}
    if FOCUS in rf.classes_:
        ci = list(rf.classes_).index(FOCUS)
        for i, f in enumerate(FEATURES):
            r = partial_dependence(
                rf, x_tr.astype(float), [i], grid_resolution=30, response_method="predict_proba"
            )
            gv = r["grid_values"][0] if "grid_values" in r else r["values"][0]
            pdp[f] = {"grid": _rl(gv), "prob": _rl(r["average"][ci])}
    out["pdp"] = pdp

    serve = {n: clone(m).fit(df[FEATURES], df[TARGET]) for n, m in candidates(seed).items()}
    return out, serve
