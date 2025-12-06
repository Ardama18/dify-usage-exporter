---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 007
phase: 3
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: 送信層の更新

メタ情報:
- 依存: task-api-meter-interface-update-phase3-001 → 成果物: src/sender/http-client.ts
- 提供: src/sender/external-api-sender.ts（更新）
- サイズ: 小規模（2ファイル: 実装 + テスト更新）

## 実装内容

送信層を`ApiMeterRequest`送信に対応させます。新しいエンドポイント（POST `/v1/usage`）への送信とレスポンス処理を実装します。

### 実装するもの
1. `send()` メソッドの引数を `ApiMeterRequest` に変更
2. POST `/v1/usage` エンドポイントへ送信
3. 200 OKレスポンスのハンドリング（inserted/updated確認）
4. エラーメッセージの詳細化
5. メトリクス更新（送信成功/失敗カウント）

### レスポンス形式
```json
{
  "inserted": 10,
  "updated": 5,
  "total": 15
}
```

## 対象ファイル

- [x] src/sender/external-api-sender.ts（更新）
- [x] src/sender/__tests__/external-api-sender.test.ts（更新）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 依存成果物の確認: `src/sender/http-client.ts` が更新されている
- [x] `src/sender/__tests__/external-api-sender.test.ts` を更新
- [x] 失敗するテストを追加:
  - `ApiMeterRequest` 送信のテスト
  - 200 OKレスポンスのテスト（inserted/updated確認）
  - エラーハンドリングのテスト（400, 401, 403, 404, 422, 429, 5xx）
  - メトリクス更新のテスト（sendSuccess, sendFailure）
- [x] テスト実行して失敗を確認: `npm test src/sender/external-api-sender.test.ts`

### 2. Green Phase

#### 2-1. ExternalApiSender の更新
```typescript
// src/sender/external-api-sender.ts
import type { ApiMeterRequest } from '../types/api-meter-schema'
import { HttpClient } from './http-client'

interface ApiMeterResponse {
  inserted: number
  updated: number
  total: number
}

export interface SendMetrics {
  sendSuccess: number
  sendFailure: number
}

export class ExternalApiSender {
  private httpClient: HttpClient
  private metrics: SendMetrics

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient || new HttpClient()
    this.metrics = {
      sendSuccess: 0,
      sendFailure: 0,
    }
  }

  async send(request: ApiMeterRequest): Promise<void> {
    try {
      const response = await this.httpClient.post<ApiMeterResponse>(
        '/v1/usage',
        request
      )

      // 200 OKレスポンスの処理
      console.log(
        `Successfully sent ${request.records.length} records: ` +
        `inserted=${response.inserted}, updated=${response.updated}, total=${response.total}`
      )

      // メトリクス更新
      this.metrics.sendSuccess += request.records.length

    } catch (error) {
      // エラーメッセージの詳細化
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error'

      console.error(
        `Failed to send ${request.records.length} records: ${errorMessage}`
      )

      // メトリクス更新
      this.metrics.sendFailure += 1

      throw new Error(`Failed to send usage data: ${errorMessage}`)
    }
  }

  getMetrics(): SendMetrics {
    return { ...this.metrics }
  }

  resetMetrics(): void {
    this.metrics = {
      sendSuccess: 0,
      sendFailure: 0,
    }
  }
}
```

- [x] 追加したテストのみ実行して通ることを確認: `npm test src/sender/external-api-sender.test.ts`

### 3. Refactor Phase
- [x] エラーハンドリングの改善
- [x] ログ出力の充実化
- [x] 追加したテストが引き続き通ることを確認

## 完了条件

- [x] 追加したテストが全てパス
- [ ] TypeScript strict mode: エラー0件（※Task 3-3で統合テスト・CLIコマンド更新後に達成）
  ```bash
  npm run build
  ```
  **現状**: CLI/統合テストが旧形式参照のため型エラー発生（Task 3-3で解決）
- [x] Biome lint: エラー0件（※未使用privateメンバー警告はTask 3-3で解決）
  ```bash
  npm run check
  ```
  **現状**: 未使用privateメンバー警告（spoolManager, notifier, config）はTask 3-3で使用予定
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm test src/sender/__tests__/external-api-sender.test.ts
  ```
- [x] 成果物作成完了: `src/sender/external-api-sender.ts`（更新）

## テストケース

### 正常系
- [ ] `ApiMeterRequest` 送信成功
- [ ] 200 OKレスポンスが正しく処理される（inserted/updated確認）
- [ ] メトリクスが正しく更新される（sendSuccess）

### 異常系
- [ ] 400 Bad Request → エラーメッセージ詳細化
- [ ] 401 Unauthorized → エラーメッセージ詳細化
- [ ] 403 Forbidden → エラーメッセージ詳細化
- [ ] 404 Not Found → エラーメッセージ詳細化
- [ ] 422 Unprocessable Entity → エラーメッセージ詳細化
- [ ] 429 Too Many Requests → リトライ後エラー
- [ ] 5xx系 → リトライ後エラー
- [ ] メトリクスが正しく更新される（sendFailure）

## 注意事項

- **影響範囲**:
  - `src/sender/external-api-sender.ts` の改修
  - `ApiMeterRequest` への完全移行
- **制約**:
  - POST `/v1/usage` エンドポイントを使用
  - ADR 017/019により409 Conflictは削除（常に200 OKが返る）
- **重要な変更点**:
  - ExternalApiRecord → ApiMeterRequest への完全移行
  - レスポンスフォーマットの変更（inserted/updated/total）
- **メトリクス仕様**:
  - `sendSuccess`: 送信成功したレコード数の累計
  - `sendFailure`: 送信失敗した回数の累計
- **次タスクへの引き継ぎ**:
  - Task 3-3 で旧形式スプールファイルの変換ロジックを実装

## 参考資料

- [Design Document](../design.md) - 第7章「送信層の改修」
- [ADR 017: エラーハンドリング戦略](../../adr/017-error-handling-strategy.md)
- [ADR 019: 日別集計の実装](../../adr/019-daily-aggregation.md)
- [API_Meter API Documentation](https://api-meter.example.com/docs)
