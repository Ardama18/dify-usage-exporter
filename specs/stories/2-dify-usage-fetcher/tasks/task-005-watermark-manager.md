# タスク: WatermarkManager実装

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 005
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: task-004 → 成果物: src/errors/dify-api-error.ts（Phase 1完了）
- 提供: src/watermark/watermark-manager.ts
- サイズ: 中規模（1ファイル + 単体テスト + 統合テスト）

## 実装内容

ウォーターマークの読み書き、バックアップ、復元機能を実装する。これにより差分取得を実現し、重複取得率0%を保証する。

## 対象ファイル
- [ ] `src/watermark/watermark-manager.ts` - WatermarkManager実装
- [ ] `test/unit/watermark/watermark-manager.test.ts` - 単体テスト
- [ ] `test/integration/dify-usage-fetcher.int.test.ts` - 統合テスト（FR-4部分）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] `test/unit/watermark/watermark-manager.test.ts` を作成
  - ファイル存在時の正常読み込みテスト
  - ファイル不存在時のnull返却テスト
  - ファイル破損時のバックアップ復元テスト
  - バックアップも破損時のエラースローテスト
  - 更新時のバックアップ作成テスト
  - パーミッション600の設定確認テスト
  - ディレクトリ自動作成テスト
- [ ] テスト実行して失敗を確認
  ```bash
  npm test -- test/unit/watermark/watermark-manager.test.ts
  ```

### 2. Green Phase
- [ ] `src/watermark/` ディレクトリを作成
- [ ] `src/watermark/watermark-manager.ts` を作成
  - createWatermarkManager関数実装
  - load()メソッド実装
    - ファイル読み込み
    - ENOENT時のnull返却
    - 破損時のバックアップ復元
  - update()メソッド実装
    - ディレクトリ自動作成
    - バックアップ作成
    - パーミッション600での書き込み
  - WatermarkFileErrorクラス定義

  ```typescript
  import fs from 'node:fs/promises'
  import path from 'node:path'
  import type { Watermark } from '../types/watermark.js'
  import type { Logger } from '../logger/winston-logger.js'
  import type { EnvConfig } from '../types/env.js'

  export interface WatermarkManagerDeps {
    config: EnvConfig
    logger: Logger
  }

  export function createWatermarkManager(deps: WatermarkManagerDeps): WatermarkManager {
    // 実装（Design Doc参照）
  }

  export interface WatermarkManager {
    load(): Promise<Watermark | null>
    update(watermark: Watermark): Promise<void>
  }

  export class WatermarkFileError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'WatermarkFileError'
    }
  }
  ```

- [ ] テスト実行して通ることを確認
  ```bash
  npm test -- test/unit/watermark/watermark-manager.test.ts
  ```

### 3. Refactor Phase
- [ ] ログ出力の最適化
- [ ] エラーメッセージの改善
- [ ] テストが引き続き通ることを確認

### 4. 統合テスト実装
- [ ] `test/integration/dify-usage-fetcher.int.test.ts` を作成/更新
  - FR-4: ウォーターマーク管理 統合テスト
  - AC-4-1: Fetcher起動時にウォーターマークファイル読み込み
  - AC-4-2: ファイル不存在時に過去30日間を取得期間に設定
  - AC-4-3: 全ページ取得完了時にウォーターマーク更新
  - AC-4-4: 更新前にバックアップファイル作成
  - AC-4-5: ファイル破損時にバックアップから復元
  - AC-4-6: ファイルパーミッション600設定
  - エッジケース: バックアップも破損、ディレクトリ不存在、書き込み権限なし、カスタムファイルパス、初回取得日数カスタマイズ
- [ ] 統合テスト実行・パス確認
  ```bash
  npm test -- test/integration/dify-usage-fetcher.int.test.ts -t "FR-4"
  ```

## 完了条件
- [ ] 単体テストが全てパス
  ```bash
  npm test -- test/unit/watermark/watermark-manager.test.ts
  ```
- [ ] 統合テスト（FR-4関連）がすべてパス
  ```bash
  npm test -- test/integration/dify-usage-fetcher.int.test.ts -t "FR-4"
  ```
- [ ] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [ ] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [ ] WatermarkManagerが正常に動作する
- [ ] バックアップ・復元機能が動作する
- [ ] パーミッション600が設定される

## 関連する受入条件（AC）
- **AC-4-1**: Fetcher起動時、システムはウォーターマークファイル（data/watermark.json）を読み込むこと
- **AC-4-2**: もしウォーターマークファイルが存在しない場合、システムは過去30日間（デフォルト）を取得期間として設定すること
- **AC-4-3**: 全ページ取得完了時、システムはウォーターマークを更新すること
- **AC-4-4**: システムはウォーターマーク更新前にバックアップファイル（watermark.json.backup）を作成すること
- **AC-4-5**: もしウォーターマークファイルが破損している場合、システムはバックアップから復元を試行すること
- **AC-4-6**: システムはウォーターマークファイルのパーミッションを600に設定すること

## 依存タスク
- task-004: カスタムエラークラス定義（Phase 1完了が前提）

## 注意事項
- 影響範囲: DifyUsageFetcher（Task 007）がWatermarkManagerを使用
- 制約: node:fs/promisesを使用（同期APIは使用しない）
- セキュリティ: パーミッション600（所有者のみ読み書き可能）を厳守
- テスト時の注意: 実際のファイルシステムを操作するため、テスト後のクリーンアップを忘れずに
