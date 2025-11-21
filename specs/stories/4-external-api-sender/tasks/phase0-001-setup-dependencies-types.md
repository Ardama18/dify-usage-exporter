---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 0
task_number: 001
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: 依存パッケージインストールと型定義作成

## メタ情報
- 依存: なし
- 提供:
  - src/types/external-api.ts
  - src/types/spool.ts
  - src/interfaces/sender.ts
- サイズ: 小規模（3ファイル）
- 確認レベル: L1（単体テスト実行）

## 実装内容
プロジェクト環境セットアップと共通型定義の作成。axios、axios-retry、zodのインストール確認、ExternalApiRecord型定義、SpoolFile型定義（zodスキーマ含む）、ISenderインターフェース定義を作成する。

## 対象ファイル
- [x] src/types/external-api.ts（既存：Story 3で作成済み）
- [x] src/types/spool.ts（新規作成）
- [x] src/interfaces/sender.ts（新規作成）
- [x] package.json（axios, axios-retry, zodの確認）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 依存パッケージ確認
  ```bash
  npm list axios axios-retry zod
  ```
- [x] 型定義ファイルのテスト作成（型の整合性確認）
  - `test/unit/types/spool.test.ts`
  - `test/unit/interfaces/sender.test.ts`
- [x] テスト実行して失敗を確認
  ```bash
  npm test -- test/unit/types/spool.test.ts test/unit/interfaces/sender.test.ts
  ```

### 2. Green Phase
- [x] ExternalApiRecord型定義作成（src/types/external-api.ts）
  - Story 3で既に作成済み、整合性確認完了
  - zodスキーマ定義済み
- [x] SpoolFile型定義作成（src/types/spool.ts）
  - batchIdempotencyKey, records, firstAttempt, retryCount, lastError
  - zodスキーマ定義（spoolFileSchema）
- [x] ISenderインターフェース定義作成（src/interfaces/sender.ts）
  - send(records: ExternalApiRecord[]): Promise<void>
  - resendSpooled(): Promise<void>
- [x] 追加したテストのみ実行して通ることを確認
  ```bash
  npm test -- test/unit/types/spool.test.ts test/unit/interfaces/sender.test.ts
  ```

### 3. Refactor Phase
- [x] 型定義の整理（重複削除、命名の一貫性）
- [x] JSDocコメント追加
- [x] zodスキーマのバリデーションルール確認
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L1: TypeScriptビルド実行）
  ```bash
  npm run build
  ```
- [x] 成果物作成完了
  - src/types/external-api.ts（既存）
  - src/types/spool.ts
  - src/interfaces/sender.ts

## 実装サンプル

### ExternalApiRecord型定義（src/types/external-api.ts）
```typescript
import { z } from 'zod'

export const ExternalApiRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  appId: z.string(),
  provider: z.string(),
  model: z.string(),
  totalTokens: z.number().int().min(0),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalCalls: z.number().int().min(0),
  idempotencyKey: z.string()
})

export type ExternalApiRecord = z.infer<typeof ExternalApiRecordSchema>
```

### SpoolFile型定義（src/types/spool.ts）
```typescript
import { z } from 'zod'
import { ExternalApiRecordSchema } from './external-api.js'

export const SpoolFileSchema = z.object({
  batchIdempotencyKey: z.string(),
  records: z.array(ExternalApiRecordSchema),
  firstAttempt: z.string().datetime(), // ISO 8601形式
  retryCount: z.number().int().min(0),
  lastError: z.string()
})

export type SpoolFile = z.infer<typeof SpoolFileSchema>
```

### ISenderインターフェース定義（src/interfaces/sender.ts）
```typescript
import type { ExternalApiRecord } from '../types/external-api.js'

/**
 * 外部API送信インターフェース
 */
export interface ISender {
  /**
   * 変換済みデータを外部APIへ送信
   * @param records - 送信するレコード配列
   * @throws {Error} - 送信失敗時（リトライ上限到達、スプール保存失敗）
   */
  send(records: ExternalApiRecord[]): Promise<void>

  /**
   * スプールファイルを再送
   * @throws {Error} - 再送失敗時
   */
  resendSpooled(): Promise<void>
}
```

## 注意事項
- **Story 3との整合性**: ExternalApiRecord型はStory 3のDesign Docと完全一致させる
- **zodスキーマの厳密性**: バリデーションルールは実行時エラーを防ぐため厳密に定義
- **型安全性**: any型の使用は禁止、unknown型と型ガードを使用
- **影響範囲**: 新規ファイル作成のみ、既存コードへの影響なし
