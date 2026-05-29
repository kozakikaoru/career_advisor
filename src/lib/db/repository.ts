import type { CareerPlan } from "@/lib/schema/result";

export interface StoredResult {
  id: string;
  plan: CareerPlan;
  createdAt: string; // ISO8601
}

/**
 * 結果ストレージの抽象。保存するのは生成結果(CareerPlan)のみ。
 * 入力の生回答・IP・トラッキングIDは保存しない(data-model.md §1)。
 */
export interface ResultsRepository {
  /** 結果を保存する */
  save(id: string, plan: CareerPlan): Promise<void>;
  /** id で取得。無ければ null */
  get(id: string): Promise<StoredResult | null>;
}
