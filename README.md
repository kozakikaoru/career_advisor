# NEXUS.path — AI 進路相談 Web アプリ

1問1答に答えると、AI があなたの現在地・目標・性格/価値観を読み解き、目標達成までの段階的なロードマップを生成します。結果は匿名で保存され、推測されにくいランダムURL(`/r/[id]`)で後から・別端末でも再表示できます。

- フレームワーク: Next.js 16(App Router) + React 19 + Tailwind CSS v4 + TypeScript
- スキーマ検証: Zod
- AI: プロバイダ差し替え可能(`mock` / `gemini`)
- ストレージ: 差し替え可能(`sqlite`(ローカル) / `neon`(本番 Postgres))

設計の詳細は会社フォルダー `architecture/` を参照。デザインは `design/mockups/result-dark.html` をベースに再現。

---

## ローカル起動方法

```bash
# 1. 依存をインストール
npm install

# 2. 環境変数を用意(既定の mock + sqlite で動く)
cp .env.example .env.local

# 3. 開発サーバー起動
npm run dev
# → http://localhost:3000
```

> 既定では **API キー不要・課金なしの Mock AI** と **ローカル SQLite** で、トップ → 同意 → 質問フロー → 結果生成 → `/r/[id]` の一連が動きます。SQLite ファイルは `./data/dev.sqlite` に作られます(gitignore 済み)。

### その他のコマンド

```bash
npm run build      # 本番ビルド
npm run start      # 本番ビルドを起動
npm run test       # Vitest(質問分岐エンジン / env 検証の単体テスト)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
```

> Node.js は 18.18+ / 20+ を推奨(Next.js 16 / React 19 の要件)。

---

## 環境変数

すべてサーバー側専用です(`NEXT_PUBLIC_` は付けない)。`.env.example` をコピーして `.env.local` に設定します。`.env*` は gitignore 済み。

| 変数 | 必須 | 例 / 既定 | 説明 |
|---|---|---|---|
| `AI_PROVIDER` | 任意 | `mock`(既定) / `gemini` | 使用する AI 実装 |
| `GEMINI_API_KEY` | `gemini` 時必須 | `AIza...` | Gemini API キー |
| `GEMINI_MODEL` | 任意 | `gemini-2.5-flash`(既定) | 使う Gemini モデル |
| `DB_PROVIDER` | 任意 | `sqlite`(既定) / `neon` | 使用するストレージ実装 |
| `DATABASE_URL` | `neon` 時必須 | `postgres://...` | Neon / Vercel Postgres 接続文字列 |
| `SQLITE_PATH` | 任意 | `./data/dev.sqlite`(既定) | ローカル SQLite ファイルパス |
| `APP_BASE_URL` | 任意 | `http://localhost:3000`(既定) | 結果URLの組み立てに使う |

`AI_PROVIDER=gemini` なのに `GEMINI_API_KEY` が無い場合、`DB_PROVIDER=neon` なのに `DATABASE_URL` が無い場合は、起動時に分かりやすいエラーで落ちます(`src/env.ts` で Zod 検証)。

---

## AI / ストレージの切替方法

### Mock → Gemini

1. Google AI Studio などで Gemini の API キーを取得。
2. `.env.local` を編集:
   ```
   AI_PROVIDER=gemini
   GEMINI_API_KEY=取得したキー
   GEMINI_MODEL=gemini-2.5-flash   # 任意。Flash-Lite 等に変更可
   ```
3. サーバーを再起動。生成時に実際の Gemini が呼ばれます。
   - 出力は `responseSchema`(構造化JSON出力)で形を誘導し、`CareerPlanSchema`(Zod)で最終検証、失敗時は1回リトライします(`src/lib/ai/gemini.ts`)。
   - **本番では機微情報を扱うため、学習に使われない有料 Tier のキーを使ってください**(設計 security 方針)。

### SQLite → Neon(本番)

1. Neon(または Vercel Postgres)でプロジェクトを作成し、接続文字列を取得。
2. `.env.local`(本番は Vercel の環境変数)を編集:
   ```
   DB_PROVIDER=neon
   DATABASE_URL=postgres://...
   ```
3. `results` テーブルは初回保存時に `CREATE TABLE IF NOT EXISTS` で自動作成されます(`src/lib/db/neon.ts`)。事前に作る場合:
   ```sql
   CREATE TABLE IF NOT EXISTS results (
     id          TEXT PRIMARY KEY,
     plan        JSONB NOT NULL,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

> SQLite はローカル開発専用です。Vercel の Serverless ではローカルファイルが永続しないため、本番は必ず Neon 等のマネージド DB を使ってください。

---

## プライバシー / データ方針(実装上の要点)

- 保存するのは **生成結果(CareerPlan の構造化JSON)のみ**。入力の生回答・IP・トラッキングIDは保存しません。
- ログにも回答本文・結果本文を残しません(プロバイダ名・所要時間・成否のみ)。
- 結果ページ(`/r/`)と診断(`/diagnosis`)は `noindex` + `robots.txt` で検索エンジンから除外。
- 生成は同意必須。`POST /api/generate` は `consent: true` でなければ拒否します。

---

## ディレクトリ構成(抜粋)

```
src/
├ app/
│  ├ page.tsx                # トップ(LP)
│  ├ diagnosis/page.tsx      # ウィザード(同意ゲート → 1問1答 → 生成)
│  ├ r/[id]/page.tsx         # 結果表示(RSC で取得)
│  ├ legal/{privacy,terms}/  # PP / 利用規約(枠。本文は差し込み待ち)
│  ├ api/generate/route.ts   # 生成エンドポイント
│  └ robots.ts
├ components/
│  ├ wizard/                 # ConsentGate / Wizard / 各入力UI / ProgressBar
│  ├ result/                 # result-dark.html を移植した A〜E の各セクション
│  └ ui/ , Loading.tsx
├ lib/
│  ├ questions/              # 質問定義(データ) + 分岐エンジン(純粋関数)
│  ├ ai/                     # AIProvider IF + Mock / Gemini + ファクトリ
│  ├ schema/                 # 回答 / 結果(CareerPlan) / リクエストの Zod
│  ├ db/                     # ResultsRepository IF + SQLite / Neon + ファクトリ
│  └ id.ts
└ env.ts                     # 環境変数の Zod 検証・集約
```
