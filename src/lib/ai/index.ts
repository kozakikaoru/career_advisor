import { getEnv } from "@/env";
import type { AIProvider } from "./types";
import { MockProvider } from "./mock";

/**
 * 環境変数 AI_PROVIDER で実装を選ぶファクトリ。
 * 既定は MockProvider(課金/外部送信しない安全側)。
 * gemini は動的 import で遅延ロードする(mock 運用時に SDK を巻き込まない)。
 */
export async function getAIProvider(): Promise<AIProvider> {
  switch (getEnv().AI_PROVIDER) {
    case "gemini": {
      const { GeminiProvider } = await import("./gemini");
      return new GeminiProvider();
    }
    case "mock":
    default:
      return new MockProvider();
  }
}

export type { AIProvider, GenerateOptions } from "./types";
