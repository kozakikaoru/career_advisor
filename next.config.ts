import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // better-sqlite3 はネイティブモジュール。サーバー側でそのまま require させ、
  // Next のバンドルに巻き込まないよう外部化する(ローカル開発専用)。
  serverExternalPackages: ["better-sqlite3"],
  // 親ディレクトリの別 lockfile を誤検出しないよう、このプロジェクトをルートに固定する。
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
