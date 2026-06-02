import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

/**
 * scripts/ ディレクトリ用の vite 設定。
 *
 * `vite-node --config scripts/vite.config.ts scripts/measure-gemini-tokens.ts` のように使う。
 * 目的は @/... alias を本番(tsconfig.json)と同じ ./src に解決すること。
 *
 * vitest.config.ts と同じ alias を持つ理由:
 * - vite-node は tsconfig の paths を読まないため、vite 側で resolve.alias を明示する必要がある。
 * - 本番アプリ側の vitest.config.ts に手を加えず、計測スクリプト用に独立した設定を置く。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
});
