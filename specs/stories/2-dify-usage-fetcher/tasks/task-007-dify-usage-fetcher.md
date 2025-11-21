# タスク: DifyUsageFetcher実装

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 007
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存:
  - task-005 → 成果物: src/watermark/watermark-manager.ts
  - task-006 → 成果物: src/fetcher/dify-api-client.ts
- 提供: src/fetcher/dify-usage-fetcher.ts
- サイズ: 大規模（1ファイル + 単体テスト + 統合テスト）

## 実装内容

全コンポーネントを統合し、オーケストレーション機能を実装する。ウォーターマーク読み込み、ページング処理、zodバリデーション、ウォーターマーク更新を連携させ、IFetcherインターフェースを実装する。

## 対象ファイル
- [ ] `src/fetcher/dify-usage-fetcher.ts` - DifyUsageFetcher実装
- [ ] `test/unit/fetcher/dify-usage-fetcher.test.ts` - 単体テスト
- [ ] `test/integration/dify-usage-fetcher.int.test.ts` - 統合テスト（FR-3, FR-6, NF部分）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] 依存成果物の確認
  - src/watermark/watermark-manager.ts
  - src/fetcher/dify-api-client.ts
  - src/interfaces/fetcher.ts
- [ ] `test/unit/fetcher/dify-usage-fetcher.test.ts` を作成
  - オーケストレーション動作テスト
  - ページング処理テスト（has_more制御）
  - バリデーション処理テスト
  - エラーハンドリングテスト
  - 進捗ログ出力テスト（100ページごと）
  - ページ間ディレイテスト（1秒）
  - ウォーターマーク更新テスト
- [ ] テスト実行して失敗を確認
  ```bash
  npm test -- test/unit/fetcher/dify-usage-fetcher.test.ts
  ```

### 2. Green Phase
- [ ] `src/fetcher/dify-usage-fetcher.ts` を作成
  - createDifyUsageFetcher関数実装
  - fetch()メソッド実装
    - ウォーターマーク読み込み
    - 開始日・終了日計算
    - ページング処理ループ
    - zodスキーマバリデーション
    - onRecordsコールバック呼び出し
    - 進捗ログ出力（100ページごと）
    - ページ間ディレイ（1秒）
    - ウォーターマーク更新
    - FetchResult返却
  - エラーハンドリング（取得済みまでウォーターマーク更新）
  - APIトークンのログ非出力

  ```typescript
  import type { IFetcher, FetchResult, FetchError } from '../interfaces/fetcher.js'
  import type { DifyApiClient } from './dify-api-client.js'
  import type { WatermarkManager } from '../watermark/watermark-manager.js'
  import type { Logger } from '../logger/winston-logger.js'
  import type { EnvConfig } from '../types/env.js'
  import type { DifyUsageRecord } from '../types/dify-usage.js'
  import { difyUsageRecordSchema } from '../types/dify-usage.js'

  export interface DifyUsageFetcherDeps {
    client: DifyApiClient
    watermarkManager: WatermarkManager
    logger: Logger
    config: EnvConfig
  }

  export function createDifyUsageFetcher(deps: DifyUsageFetcherDeps): IFetcher {
    // 実装（Design Doc参照）
  }
  ```

- [ ] ヘルパー関数実装
  - calculateStartDate() - ウォーターマークから開始日を計算
  - formatDate() - Dateを'YYYY-MM-DD'形式に変換
  - validateRecords() - zodでバリデーション、エラーをスキップ
  - sleep() - ページ間ディレイ用

- [ ] テスト実行して通ることを確認
  ```bash
  npm test -- test/unit/fetcher/dify-usage-fetcher.test.ts
  ```

### 3. Refactor Phase
- [ ] 処理フローの最適化
- [ ] ログ出力の改善
- [ ] テストが引き続き通ることを確認

### 4. 統合テスト実装
- [ ] `test/integration/dify-usage-fetcher.int.test.ts` を更新
  - FR-3: ページング処理 統合テスト（4件 + 4エッジケース）
    - AC-3-1: has_more=trueで継続取得
    - AC-3-2: 1秒ディレイ挿入
    - AC-3-3: DIFY_FETCH_PAGE_SIZE反映
    - AC-3-4: 100ページごと進捗ログ
  - FR-6: データバリデーション 統合テスト（4件 + 4エッジケース）
    - AC-6-1: zodスキーマ検証
    - AC-6-2: 必須フィールド確認
    - AC-6-3: バリデーションエラー時スキップ
    - AC-6-4: トークン数検証
  - 非機能要件 統合テスト（4件）
    - AC-NF-1: 10,000件を30秒以内
    - AC-NF-2: メモリ100MB以内
    - AC-NF-3: 重複取得率0%
    - AC-NF-4: APIトークン非出力
  - コンポーネント連携 統合テスト（5件）
    - DifyApiClient → DifyUsageFetcher
    - WatermarkManager → DifyUsageFetcher
    - 全コンポーネント連携
- [ ] 統合テスト実行・パス確認
  ```bash
  npm test -- test/integration/dify-usage-fetcher.int.test.ts
  ```

## 完了条件
- [ ] 単体テストが全てパス
  ```bash
  npm test -- test/unit/fetcher/dify-usage-fetcher.test.ts
  ```
- [ ] 統合テスト（FR-3, FR-6, NF関連）がすべてパス
  ```bash
  npm test -- test/integration/dify-usage-fetcher.int.test.ts
  ```
- [ ] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [ ] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [ ] DifyUsageFetcherが正常に動作する
- [ ] 全コンポーネントが連携して動作する
- [ ] Design DocのE2E確認手順が成功

## 関連する受入条件（AC）
- **AC-2-1**: Fetcherが起動したとき、システムはDify Console API `/console/api/usage` を呼び出すこと
- **AC-3-1**: has_moreがtrueの間、システムは次のページを取得し続けること
- **AC-3-2**: システムは各ページ取得後に1秒のディレイを挿入すること
- **AC-3-3**: もしDIFY_FETCH_PAGE_SIZE環境変数が設定されている場合、システムはその値を1ページあたりの取得件数として使用すること
- **AC-3-4**: 100ページ取得するごとに、システムは進捗ログを出力すること
- **AC-5-5**: もしページ取得中にエラーが発生した場合、システムは取得済みデータまでウォーターマークを更新すること
- **AC-6-1**: システムはAPIレスポンスをzodスキーマで検証すること
- **AC-6-2**: システムは必須フィールド（date, app_id, provider, model, total_tokens）の存在を確認すること
- **AC-6-3**: もしバリデーションエラーが発生した場合、システムはエラーログを記録して該当レコードをスキップすること
- **AC-6-4**: システムはトークン数が0以上の整数であることを検証すること
- **AC-NF-1**: システムは10,000件のレコードを30秒以内で取得すること
- **AC-NF-2**: システムはメモリ使用量を100MB以内に抑制すること
- **AC-NF-3**: システムは重複取得率0%を保証すること（ウォーターマーク方式）
- **AC-NF-4**: システムはAPIトークンをログに出力しないこと

## 依存タスク
- task-005: WatermarkManager実装
- task-006: DifyApiClient実装

## 注意事項
- 影響範囲: Story 3（ITransformer）、Story 4（ISender）と連携予定
- 制約: IFetcherインターフェースを完全に実装すること
- パフォーマンス: メモリ効率のため、onRecordsコールバックで即時処理
- セキュリティ: APIトークンをログに出力しないこと
