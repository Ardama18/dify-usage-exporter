# タスク: DifyApiClient実装

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 006
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: task-004 → 成果物: src/errors/dify-api-error.ts（Phase 1完了）
- 提供: src/fetcher/dify-api-client.ts
- サイズ: 中規模（1ファイル + 単体テスト + 統合テスト）

## 実装内容

Dify Console APIとのHTTP通信、Bearer Token認証、指数バックオフリトライを実装する。ADR 002（リトライポリシー）、ADR 007（HTTPクライアント）に準拠。

## 対象ファイル
- [ ] `src/fetcher/dify-api-client.ts` - DifyApiClient実装
- [ ] `test/unit/fetcher/dify-api-client.test.ts` - 単体テスト
- [ ] `test/integration/dify-usage-fetcher.int.test.ts` - 統合テスト（FR-1, FR-2, FR-5部分）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] axios, axios-retryパッケージがインストールされているか確認
  ```bash
  npm list axios axios-retry
  ```
- [ ] `test/unit/fetcher/dify-api-client.test.ts` を作成
  - 認証ヘッダー設定確認テスト
  - タイムアウト設定確認テスト
  - リトライ設定確認テスト（retries, retryDelay, retryCondition）
  - パラメータ構築確認テスト
  - Retry-Afterヘッダー対応テスト
- [ ] テスト実行して失敗を確認
  ```bash
  npm test -- test/unit/fetcher/dify-api-client.test.ts
  ```

### 2. Green Phase
- [ ] `src/fetcher/` ディレクトリを作成
- [ ] `src/fetcher/dify-api-client.ts` を作成
  - createDifyApiClient関数実装
  - axiosインスタンス作成（baseURL, timeout, headers）
  - Bearer Token認証ヘッダー設定
  - axios-retryによるリトライ設定
    - 指数バックオフ（1秒→2秒→4秒）
    - リトライ条件（ネットワークエラー、5xx、429）
    - Retry-Afterヘッダー対応
  - リクエスト/レスポンスインターセプター（ログ出力）
  - fetchUsage()メソッド実装

  ```typescript
  import axios, { type AxiosError } from 'axios'
  import axiosRetry from 'axios-retry'
  import type { EnvConfig } from '../types/env.js'
  import type { Logger } from '../logger/winston-logger.js'
  import type { DifyUsageResponse } from '../types/dify-usage.js'

  export interface DifyApiClientDeps {
    config: EnvConfig
    logger: Logger
  }

  export interface FetchUsageParams {
    startDate: string  // YYYY-MM-DD
    endDate: string    // YYYY-MM-DD
    page: number
    limit: number
  }

  export function createDifyApiClient(deps: DifyApiClientDeps): DifyApiClient {
    // 実装（Design Doc参照）
  }

  export interface DifyApiClient {
    fetchUsage(params: FetchUsageParams): Promise<DifyUsageResponse>
  }
  ```

- [ ] テスト実行して通ることを確認
  ```bash
  npm test -- test/unit/fetcher/dify-api-client.test.ts
  ```

### 3. Refactor Phase
- [ ] インターセプターの最適化
- [ ] エラーハンドリングの改善
- [ ] テストが引き続き通ることを確認

### 4. 統合テスト実装
- [ ] `test/integration/dify-usage-fetcher.int.test.ts` を更新
  - FR-1: Dify API認証 統合テスト（3件 + 2エッジケース）
    - AC-1-1: 全リクエストにBearer Token含む
    - AC-1-2: DIFY_API_TOKEN未設定時のエラー
    - AC-1-3: 401エラー時のログ出力・終了
  - FR-2: 使用量データ取得API呼び出し 統合テスト（4件 + 3エッジケース）
    - AC-2-1: /console/api/usage呼び出し
    - AC-2-2: パラメータ正しく設定
    - AC-2-3: JSONレスポンス解析
    - AC-2-4: タイムアウト30秒
  - FR-5: エラーハンドリング 統合テスト（5件 + 6エッジケース）
    - AC-5-1: ネットワークエラー/5xx/429リトライ
    - AC-5-2: 400/401/403/404リトライなし
    - AC-5-3: Retry-Afterヘッダー対応
    - AC-5-4: 構造化ログ記録
- [ ] 統合テスト実行・パス確認
  ```bash
  npm test -- test/integration/dify-usage-fetcher.int.test.ts -t "FR-1\|FR-2\|FR-5"
  ```

## 完了条件
- [ ] 単体テストが全てパス
  ```bash
  npm test -- test/unit/fetcher/dify-api-client.test.ts
  ```
- [ ] 統合テスト（FR-1, FR-2, FR-5関連）がすべてパス
  ```bash
  npm test -- test/integration/dify-usage-fetcher.int.test.ts -t "FR-1\|FR-2\|FR-5"
  ```
- [ ] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [ ] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [ ] DifyApiClientが正常に動作する
- [ ] Bearer Token認証が全リクエストに含まれる
- [ ] リトライ設定がADR 002準拠

## 関連する受入条件（AC）
- **AC-1-1**: システムはすべてのAPIリクエストに`Authorization: Bearer ${DIFY_API_TOKEN}`ヘッダーを含めること
- **AC-1-2**: もし環境変数`DIFY_API_TOKEN`が未設定の場合、システムは起動時にエラーを出力して終了すること
- **AC-1-3**: もしAPIが401エラーを返した場合、システムはエラーログを出力して処理を終了すること
- **AC-2-1**: Fetcherが起動したとき、システムはDify Console API `/console/api/usage` を呼び出すこと
- **AC-2-2**: システムはstart_date、end_date、page、limitパラメータを正しく設定すること
- **AC-2-3**: もしAPIがJSON形式のレスポンスを返した場合、システムはDifyUsageResponse型として解析すること
- **AC-2-4**: システムはAPIタイムアウトを30秒（デフォルト）に設定すること
- **AC-5-1**: もしネットワークエラー/5xx/429が発生した場合、システムは指数バックオフで最大3回リトライすること
- **AC-5-2**: もし400/401/403/404エラーが発生した場合、システムはリトライせずに処理を終了すること
- **AC-5-3**: もし429エラーでRetry-Afterヘッダーが存在する場合、システムはその値を待機時間として使用すること
- **AC-5-4**: システムはすべてのエラーを構造化ログ（JSON形式）で記録すること

## 依存タスク
- task-004: カスタムエラークラス定義（Phase 1完了が前提）

## 注意事項
- 影響範囲: DifyUsageFetcher（Task 007）がDifyApiClientを使用
- 制約: ADR 002（リトライポリシー）、ADR 007（HTTPクライアント）に準拠
- セキュリティ: APIトークンをログに出力しないこと（AC-NF-4）
- Task 005と並列実行可能
