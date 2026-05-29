import { nanoid } from "nanoid";

/**
 * 結果URL用の推測困難なランダムID。
 * nanoid(21)(URL-safe, 約126bit)。連番にしない・作成日時を含めない。
 * これは「URLを知っている人だけ閲覧可能」という共有前提の秘匿性を支える(data-model.md §4)。
 */
export function generateId(): string {
  return nanoid(21);
}
