import type { AnswerMap } from "@/lib/schema/answers";
import type { CareerPlan } from "@/lib/schema/result";

export interface GenerateOptions {
  /** 生成のタイムアウト(ms)。Route Handler の maxDuration より短く */
  timeoutMs?: number;
  /** 失敗時の検証リトライ回数(既定 1) */
  maxRetries?: number;
}

/**
 * AI プロバイダの抽象。呼び出し側(Route Handler)は「どの LLM か」を知らず、
 * generateCareerPlan(answers) を呼ぶだけ。実装は env(AI_PROVIDER)で差し替える。
 */
export interface AIProvider {
  /** プロバイダ名(ログ・デバッグ用。回答本文はログに残さない) */
  readonly name: string;
  /**
   * 回答から進路プラン(構造化JSON)を生成する。
   * 返り値は CareerPlan スキーマで検証済み。検証に失敗し続けた場合は例外を投げる。
   */
  generateCareerPlan(answers: AnswerMap, opts?: GenerateOptions): Promise<CareerPlan>;
}
