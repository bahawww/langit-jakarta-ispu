import { useApi } from "@/lib/api";

/** Tiga model dasar, urut seperti di seluruh aplikasi. Kunci sama dengan keluaran /api/analysis. */
export const MODEL_KEYS = ["random_forest", "decision_tree", "knn"] as const;
export type AModel = (typeof MODEL_KEYS)[number];
export const A_MODEL_NAME: Record<AModel, string> = {
  random_forest: "Random Forest",
  decision_tree: "Decision Tree",
  knn: "kNN (k=5)",
};

export type Curve = { auc: number; fpr: number[]; tpr: number[] };
export type PrCurve = { ap: number; recall: number[]; precision: number[] };
export type TreeNode = {
  n: number;
  label: string;
  leaf: boolean;
  depth?: number;
  feature?: string;
  threshold?: number;
  children?: TreeNode[];
};

/** Bentuk JSON dari ml/ispu_ml/analysis.py (disimpan di /artifacts/analysis/analysis.json). */
export type Analysis = {
  data_hash: string;
  created_at: string;
  rows: number;
  n_train: number;
  n_test: number;
  labels: string[];
  focus: string;
  features: Record<string, string>;
  baselines: { majority: { label: string; accuracy: number }; random: { accuracy: number } };
  test_accuracy: Record<AModel, number>;
  presets: Record<string, Record<string, number>>;
  ranges: Record<string, number>;
  importance: Record<AModel, Record<string, number>>;
  roc: Record<AModel, Curve>;
  pr: { label: string } & Partial<Record<AModel, PrCurve>>;
  cv: Record<AModel, { accuracy: number[]; macro_f1: number[] }>;
  learning: { sizes: number[] } & Record<AModel, { train: number[]; val: number[] }>;
  depth: { depth: number[]; train: number[]; test: number[] };
  grid: {
    n_estimators: number[];
    max_depth: (number | null)[];
    f1: number[][];
    default: { n_estimators: number; max_depth: number | null };
  };
  tree: TreeNode;
  pdp: Record<string, { grid: number[]; prob: number[] }>;
};

export const useAnalysis = () => useApi<Analysis>("/analysis");

export type SimResult = {
  models: Record<AModel, { label: string; probabilities: Record<string, number> }>;
  ispu_category: string;
};
