# タスク: Fetcherインターフェース定義

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 002
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: task-001 → 成果物: src/types/dify-usage.ts
- 提供: src/interfaces/fetcher.ts
- サイズ: 小規模（1ファイル）

## 実装内容

IFetcherインターフェースとFetchResult、FetchError型を定義する。これにより、Fetcherの統一された契約を確立し、将来の拡張やテストを容易にする。

## 対象ファイル
- [x] `src/interfaces/fetcher.ts` - Fetcherインターフェース定義

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 依存成果物の確認（src/types/dify-usage.ts）
- [x] 型定義の設計確認

### 2. Green Phase
- [x] `src/interfaces/` ディレクトリを作成
- [x] `src/interfaces/fetcher.ts` を作成
  ```typescript
  import type { DifyUsageRecord } from '../types/dify-usage.js'

  export interface IFetcher {
    /**
     * 使用量データを取得し、コールバックで処理する
     * @param onRecords 取得したレコードを処理するコールバック
     * @returns 取得結果のサマリー
     */
    fetch(onRecords: (records: DifyUsageRecord[]) => Promise<void>): Promise<FetchResult>
  }

  export interface FetchResult {
    success: boolean
    totalRecords: number
    totalPages: number
    startDate: string
    endDate: string
    durationMs: number
    errors: FetchError[]
  }

  export interface FetchError {
    type: 'validation' | 'api' | 'watermark'
    message: string
    details?: Record<string, unknown>
  }
  ```

- [x] 型の整合性確認（DifyUsageRecordとの連携）
  ```bash
  npm run build
  ```

### 3. Refactor Phase
- [x] JSDocコメントの充実
- [x] 型定義の整理

## 完了条件
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] インターフェースがDesign Docの設計と一致
- [x] 型エクスポートが正しく動作

## 関連する受入条件（AC）
- **AC-2-1**: Fetcherが起動したとき、システムはDify Console API `/console/api/usage` を呼び出すこと（インターフェース定義）

## 依存タスク
- task-001: 型定義・zodスキーマ実装

## 注意事項
- 影響範囲: DifyUsageFetcher（Task 007）がこのインターフェースを実装
- 制約: onRecordsコールバックは非同期（Promise<void>）であること
- 将来の拡張: ITransformer、ISenderと連携予定（Story 3, 4）
