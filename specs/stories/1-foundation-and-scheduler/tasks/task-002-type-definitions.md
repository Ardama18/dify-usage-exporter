---
story_id: "1"
title: foundation-and-scheduler
feature: foundation
task_number: "002"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: 型定義作成

メタ情報:
- 依存: task-001 → 成果物: package.json, tsconfig.json
- 提供: src/types/env.ts（EnvSchema, EnvConfig型）
- サイズ: 小規模（1ファイル）

## 実装内容

環境変数のZodスキーマと型定義を作成する。Design Docの型定義に完全準拠し、後続の環境変数管理モジュールで使用する。

## 対象ファイル

- [x] src/types/env.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] ディレクトリ作成
  ```bash
  mkdir -p src/types
  ```
- [x] 型定義ファイルの作成（空）
- [x] TypeScriptビルドが失敗することを確認（実装前）

### 2. Green Phase

- [x] EnvSchemaの実装（Design Doc準拠）
  ```typescript
  // src/types/env.ts
  import { z } from 'zod'

  export const envSchema = z.object({
    // 必須環境変数
    DIFY_API_URL: z.string().url(),
    DIFY_API_TOKEN: z.string().min(1),
    EXTERNAL_API_URL: z.string().url(),
    EXTERNAL_API_TOKEN: z.string().min(1),

    // オプション環境変数（デフォルト値あり）
    CRON_SCHEDULE: z.string().default('0 0 * * *'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    GRACEFUL_SHUTDOWN_TIMEOUT: z.coerce.number().min(1).max(300).default(30),
    MAX_RETRY: z.coerce.number().min(1).max(10).default(3),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  })

  export type EnvConfig = z.infer<typeof envSchema>
  ```
- [x] TypeScriptビルドが成功することを確認

### 3. Refactor Phase

- [x] コード品質確認
  - インポートの整理
  - コメントの追加（必要に応じて）
- [x] `npm run check` でlint/formatエラーなし

## 完了条件

- [x] Design DocのenvSchemaと完全一致
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L1: ビルド成功）
  ```bash
  npm run build && npm run check
  ```

## 注意事項

- **影響範囲**: env-config.ts、後続全モジュールが依存
- **制約**: Design Docのインターフェース定義に完全準拠
- **型定義詳細**:
  - 必須: DIFY_API_URL, DIFY_API_TOKEN, EXTERNAL_API_URL, EXTERNAL_API_TOKEN
  - オプション: CRON_SCHEDULE, LOG_LEVEL, GRACEFUL_SHUTDOWN_TIMEOUT, MAX_RETRY, NODE_ENV
  - 数値型は `z.coerce.number()` で文字列からの変換を許可
  - LOG_LEVELは4値のenum（error, warn, info, debug）
  - NODE_ENVは3値のenum（development, production, test）
