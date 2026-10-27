import type { OrangeRow } from "@/lib/api";

/** Tiga model dasar (bawaan sklearn/Orange, tanpa tuning). Kunci = parameter URL `model`. */
export const MODELS = {
  rf: { label: "Random Forest", pred: (r: OrangeRow) => r.pred_random_forest },
  dt: { label: "Decision Tree", pred: (r: OrangeRow) => r.pred_decision_tree },
  knn: { label: "kNN (k=5)", pred: (r: OrangeRow) => r.pred_knn },
} as const;
export type ModelKey = keyof typeof MODELS;
export const isModelKey = (v: string | null): v is ModelKey => v != null && v in MODELS;
