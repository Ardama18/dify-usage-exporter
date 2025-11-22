---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "002"
phase: 1
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: CLI基盤構築

メタ情報:
- 依存: なし
- 提供: src/cli/bootstrap.ts, src/cli/index.ts, src/cli/types.ts
- サイズ: 小規模（3ファイル）

## 実装内容

CLI層の基盤を構築する。
- bootstrap.ts: 依存関係構築（CliDependencies型、bootstrapCli関数）
- index.ts: Commanderプログラム設定、エントリーポイント
- types.ts: CLI固有の型定義

## 対象ファイル
- [x] src/cli/bootstrap.ts（新規）
- [x] src/cli/index.ts（新規）
- [x] src/cli/types.ts（新規）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] Design Docのbootstrap設計を確認
- [x] types.tsの型定義を作成
  ```typescript
  export interface ResendResult {
    filename: string
    success: boolean
    recordCount: number
    error?: string
  }

  export interface ResendSummary {
    successful: ResendResult[]
    failed: ResendResult[]
    totalRecords: number
  }

  export interface FailedFileInfo {
    filename: string
    recordCount: number
    firstAttempt: string
    lastError: string
  }
  ```

### 2. Green Phase
- [x] bootstrap.tsの実装
  ```typescript
  export interface CliDependencies {
    config: EnvConfig
    logger: Logger
    spoolManager: SpoolManager
    watermarkManager: WatermarkManager
    externalApiSender: ExternalApiSender
  }

  export function bootstrapCli(): CliDependencies {
    // Design Doc記載のDI構築フロー
  }
  ```
- [x] index.tsの実装
  ```typescript
  import { Command } from 'commander'
  import { bootstrapCli } from './bootstrap.js'

  async function main(): Promise<void> {
    const deps = bootstrapCli()
    const program = new Command()
    program
      .name('dify-usage-exporter')
      .description('Dify usage data exporter CLI')
      .version('1.0.0')

    // コマンド登録は後続タスクで追加
    await program.parseAsync()
  }

  main().catch((error) => {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
  ```
- [x] 型チェック・lint通過を確認

### 3. Refactor Phase
- [x] インポートパスの整理
- [x] 型定義の最適化
- [x] 型チェックが引き続き通ることを確認

## 完了条件
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L1: ビルド成功）
  ```bash
  npm run build
  ```
- [x] コマンドパッケージが正しくインポートされる
  ```bash
  npx tsx src/cli/index.ts --help
  ```

## 注意事項
- 影響範囲: src/cli/（新規作成）
- 制約: 既存コードへの変更なし
- commander依存パッケージが必要（package.jsonへの追加は後続タスク）

## ACトレーサビリティ
- AC-COMMON-1, AC-COMMON-2, AC-COMMON-3
