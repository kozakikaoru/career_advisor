import { describe, it, expect } from "vitest";
import { AnswerMapSchema } from "./answers";

describe("AnswerMapSchema — ホワイトリスト検証(Med-2)", () => {
  it("定義済み質問ID + 定義済み value の回答は通る", () => {
    const res = AnswerMapSchema.safeParse({
      stage: "working",
      field: "営業",
      experience: "3to5",
      goal_direction: ["specialist", "management"],
      free_note: "自由記述テキスト",
    });
    expect(res.success).toBe(true);
  });

  it("未定義の質問IDは弾く", () => {
    const res = AnswerMapSchema.safeParse({ unknown_id: "x" });
    expect(res.success).toBe(false);
  });

  it("single で未定義の選択値は弾く", () => {
    const res = AnswerMapSchema.safeParse({ stage: "not_a_real_value" });
    expect(res.success).toBe(false);
  });

  it("multi に未定義の選択値が混じると弾く", () => {
    const res = AnswerMapSchema.safeParse({
      goal_direction: ["specialist", "bogus"],
    });
    expect(res.success).toBe(false);
  });

  it("single に配列を渡すと弾く(型不一致)", () => {
    const res = AnswerMapSchema.safeParse({ stage: ["working"] });
    expect(res.success).toBe(false);
  });

  it("multi に文字列を渡すと弾く(型不一致)", () => {
    const res = AnswerMapSchema.safeParse({ goal_direction: "specialist" });
    expect(res.success).toBe(false);
  });

  it("text/textarea は自由文字列を許可する", () => {
    const res = AnswerMapSchema.safeParse({
      field: "どんな分野でも自由に書ける",
      free_note: "改行や記号も含む 自由な文章 !?#",
    });
    expect(res.success).toBe(true);
  });

  it("既存の上限検証(値の長さ)は維持される", () => {
    const res = AnswerMapSchema.safeParse({ field: "あ".repeat(2001) });
    expect(res.success).toBe(false);
  });
});
