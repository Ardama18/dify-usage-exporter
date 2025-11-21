# タスク: 環境変数スキーマ拡張

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 003
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: task-002 → 成果物: src/interfaces/fetcher.ts
- 提供: src/types/env.ts（拡張）
- サイズ: 小規模（1-2ファイル + テスト）

## 実装内容

Dify Fetcher関連の環境変数をenvSchemaに追加する。ページサイズ、タイムアウト、リトライ設定などの設定をサポートし、デフォルト値と範囲チェックを実装する。

## 対象ファイル
- [ ] `src/types/env.ts` - 環境変数スキーマ拡張
- [ ] `src/config/env-config.ts` - 更新（必要な場合）
- [ ] `test/unit/types/env.test.ts` - 既存テストに新規項目追加

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] 既存の `test/unit/types/env.test.ts` を確認
- [ ] 新規環境変数のテストケースを追加
  - DIFY_FETCH_PAGE_SIZE: デフォルト値100、範囲1-1000
  - DIFY_INITIAL_FETCH_DAYS: デフォルト値30、範囲1-365
  - DIFY_FETCH_TIMEOUT_MS: デフォルト値30000、範囲1000-120000
  - DIFY_FETCH_RETRY_COUNT: デフォルト値3、範囲1-10
  - DIFY_FETCH_RETRY_DELAY_MS: デフォルト値1000、範囲100-10000
  - WATERMARK_FILE_PATH: デフォルト値'data/watermark.json'
- [ ] テスト実行して失敗を確認
  ```bash
  npm test -- test/unit/types/env.test.ts
  ```

### 2. Green Phase
- [ ] `src/types/env.ts` を読み込み、既存スキーマを確認
- [ ] Dify Fetcher関連の環境変数を追加
  ```typescript
  // Dify Fetcher関連（新規追加）
  DIFY_FETCH_PAGE_SIZE: z.coerce.number().min(1).max(1000).default(100),
  DIFY_INITIAL_FETCH_DAYS: z.coerce.number().min(1).max(365).default(30),
  DIFY_FETCH_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(30000),
  DIFY_FETCH_RETRY_COUNT: z.coerce.number().min(1).max(10).default(3),
  DIFY_FETCH_RETRY_DELAY_MS: z.coerce.number().min(100).max(10000).default(1000),
  WATERMARK_FILE_PATH: z.string().default('data/watermark.json'),
  ```

- [ ] `src/config/env-config.ts` が変更必要か確認（通常は不要）
- [ ] テスト実行して通ることを確認
  ```bash
  npm test -- test/unit/types/env.test.ts
  ```

### 3. Refactor Phase
- [ ] 環境変数のグループ化（コメント整理）
- [ ] 既存テストと新規テストの整合性確認
- [ ] テストが引き続き通ることを確認

## 完了条件
- [ ] 既存テストと新規テストがすべてパス
  ```bash
  npm test -- test/unit/types/env.test.ts
  ```
- [ ] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [ ] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [ ] 新規環境変数がスキーマに追加されている
- [ ] デフォルト値が正しく設定されている
- [ ] 範囲チェック（min/max）が機能している

## 関連する受入条件（AC）
- **AC-1-2**: もし環境変数`DIFY_API_TOKEN`が未設定の場合、システムは起動時にエラーを出力して終了すること
- **AC-2-4**: システムはAPIタイムアウトを30秒（デフォルト）に設定すること
- **AC-3-3**: もしDIFY_FETCH_PAGE_SIZE環境変数が設定されている場合、システムはその値を1ページあたりの取得件数として使用すること
- **AC-4-2**: もしウォーターマークファイルが存在しない場合、システムは過去30日間（デフォルト）を取得期間として設定すること

## 依存タスク
- task-002: Fetcherインターフェース定義

## 注意事項
- 影響範囲: 全てのDify Fetcher関連コンポーネントがこの設定を使用
- 制約: 既存の環境変数スキーマを壊さないこと
- `.env.example` の更新も忘れずに行う
