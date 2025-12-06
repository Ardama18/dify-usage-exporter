---
id: 017
feature: api-meter-interface-migration
type: adr
version: 1.0.0
created: 2025-12-04
based_on: requirements analysis for API_Meter new specification
---

# ADR 017: エラーハンドリング戦略

## ステータス

Accepted

- Date: 2025-12-06
- Implemented in: v1.1.0

## コンテキスト

API_Meterの新仕様（2025-12-04版）では、エラーハンドリングとリトライポリシーが明確化された。既存のエラーハンドリング（ADR 002: リトライポリシー）を拡張し、新仕様に対応する必要がある。

### 既存のリトライポリシー（ADR 002）

```typescript
// src/sender/http-client.ts
axiosRetry(this.client, {
  retries: config.MAX_RETRIES, // デフォルト3回
  retryDelay: axiosRetry.exponentialDelay, // 指数バックオフ
  retryCondition: (error: AxiosError) => {
    if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
      return true
    }
    const status = error.response?.status
    return status === 429 || (status !== undefined && status >= 500)
  },
})
```

- **リトライ対象**: ネットワークエラー、5xx、429
- **リトライ戦略**: 指数バックオフ（1s → 2s → 4s）
- **最大リトライ回数**: 3回（デフォルト）

### 新仕様の要求（REQ-006, REQ-007）とAPI_Meterチームの確認

**REQ-006: エラーハンドリング（API_Meterチーム確認済み）**
- **冪等性**: 内部的にUPSERTで処理、常に200 OKを返す（409 Conflictは返されない）
- **指数バックオフ**: 1s → 2s → 4s（最大3回リトライ）
- **リトライ対象**: 429, 5xx（500, 502, 503, 504）
- **リトライしない**: 4xx（400, 401, 403, 404, 422）

**REQ-007: バッチサイズ管理**
- **推奨バッチサイズ**: 100-500レコード
- **最大バッチサイズ**: API_Meter側の制限に従う（要確認）

### 制約事項

- 200 OKレスポンスで`inserted`/`updated`を確認し、冪等性を判断
- リトライ上限到達時はスプールファイルに保存（既存機構を維持）
- バッチサイズは環境変数で調整可能（BATCH_SIZE）

## 決定事項

### 1. API_Meter冪等性の理解（409 Conflictは返されない）

**API_Meterチームからの確認事項**（2025-12-04）:
- 質問4: 409 Conflictの有無 → **回答: 返さない（常に200 OKまたは4xx/5xx）**
- 冪等性は内部的にUPSERTで処理され、初回送信・再送信ともに`200 OK`を返す
- クライアント側でINSERT/UPDATEを区別する必要はない

```typescript
// src/sender/external-api-sender.ts
async sendToExternalApi(records: ApiMeterUsageRecord[]): Promise<void> {
  const response = await this.httpClient.post('/v1/usage', {
    tenant_id: this.config.API_METER_TENANT_ID,
    export_metadata: { ... },
    records,
  })

  // 200 OKレスポンス: 成功（INSERT/UPDATE両方を含む）
  if (response.status === 200) {
    const result = response.data
    this.metrics.sendSuccess += records.length
    this.logger.info('Send success', {
      recordCount: records.length,
      inserted: result.inserted,  // INSERT件数
      updated: result.updated,    // UPDATE件数（冪等性による上書き）
    })
    return
  }

  // その他の成功ステータス
  if ([201, 204].includes(response.status)) {
    this.metrics.sendSuccess += records.length
    this.logger.info('Send success', { recordCount: records.length })
    return
  }

  // エラーはaxios-retryで自動リトライまたは例外スロー
}
```

### 2. リトライ条件の更新

```typescript
// src/sender/http-client.ts
axiosRetry(this.client, {
  retries: config.MAX_RETRIES, // デフォルト3回
  retryDelay: axiosRetry.exponentialDelay, // 1s → 2s → 4s
  retryCondition: (error: AxiosError) => {
    const status = error.response?.status

    // 成功扱い（リトライしない）: 200, 201, 204
    if (status && [200, 201, 204].includes(status)) {
      return false
    }

    // リトライ対象: 429（Rate Limit）, 5xx（Server Error）
    if (status === 429 || (status && status >= 500)) {
      return true
    }

    // ネットワークエラー（ECONNREFUSED, ETIMEDOUT等）: リトライ
    if (axiosRetry.isNetworkError(error)) {
      return true
    }

    // その他（400, 401, 403, 404, 422等）: リトライしない
    return false
  },
  onRetry: (retryCount, error, requestConfig) => {
    this.logger.warn('Retrying request', {
      retryCount,
      url: requestConfig.url,
      status: error.response?.status,
      message: error.message,
      delay: `${2 ** retryCount}s`, // 1s, 2s, 4s
    })
  },
})
```

### 3. ステータスコード分類

**注**: API_Meterチームからの確認（2025-12-04）により、409 Conflictは返されないことが判明。冪等性は内部的にUPSERTで処理され、常に200 OKを返す。

| ステータスコード | 分類 | 処理 | リトライ |
|---------------|------|------|---------|
| 200, 201, 204 | 成功 | メトリクス更新 | なし |
| 400 Bad Request | クライアントエラー | エラーログ、スプール保存 | なし |
| 401 Unauthorized | 認証エラー | エラーログ、即座に失敗 | なし |
| 403 Forbidden | 認可エラー | エラーログ、即座に失敗 | なし |
| 404 Not Found | エンドポイントエラー | エラーログ、即座に失敗 | なし |
| 422 Unprocessable Entity | バリデーションエラー | エラーログ、スプール保存 | なし |
| 429 Too Many Requests | Rate Limit | 警告ログ、リトライ | あり（指数バックオフ） |
| 500 Internal Server Error | サーバーエラー | エラーログ、リトライ | あり |
| 502 Bad Gateway | ゲートウェイエラー | エラーログ、リトライ | あり |
| 503 Service Unavailable | サービス停止 | エラーログ、リトライ | あり |
| 504 Gateway Timeout | タイムアウト | エラーログ、リトライ | あり |

### 4. エラーメッセージの詳細化

```typescript
// src/sender/external-api-sender.ts
private handleSendError(error: unknown, records: ApiMeterUsageRecord[]): void {
  if (error instanceof AxiosError) {
    const status = error.response?.status
    const data = error.response?.data

    // ステータスコード別のエラーメッセージ
    switch (status) {
      case 400:
        this.logger.error('Bad Request (400)', {
          message: 'Invalid request format',
          details: data,
          recordCount: records.length,
        })
        break
      case 401:
        this.logger.error('Unauthorized (401)', {
          message: 'Invalid API_METER_TOKEN',
          hint: 'Check API_METER_TOKEN environment variable',
        })
        break
      case 403:
        this.logger.error('Forbidden (403)', {
          message: 'Insufficient permissions for tenant',
          tenantId: this.config.API_METER_TENANT_ID,
        })
        break
      case 422:
        this.logger.error('Unprocessable Entity (422)', {
          message: 'Validation error',
          details: data,
          recordCount: records.length,
        })
        break
      case 429:
        this.logger.warn('Rate Limit Exceeded (429)', {
          message: 'Too many requests, will retry',
          retryAfter: error.response?.headers['retry-after'],
        })
        break
      default:
        this.logger.error('HTTP Error', {
          status,
          message: error.message,
          details: data,
        })
    }
  } else {
    // 非HTTPエラー（ネットワークエラー等）
    this.logger.error('Non-HTTP Error', {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
```

### 5. Retry-Afterヘッダーの尊重（REQ-006拡張）

```typescript
// src/sender/http-client.ts
axiosRetry(this.client, {
  retries: config.MAX_RETRIES,
  retryDelay: (retryCount, error) => {
    // Retry-Afterヘッダーがある場合は尊重
    const retryAfter = error.response?.headers['retry-after']
    if (retryAfter) {
      const delay = parseInt(retryAfter, 10) * 1000 // 秒→ミリ秒
      if (!isNaN(delay)) {
        this.logger.info('Respecting Retry-After header', { delay: `${delay}ms` })
        return delay
      }
    }

    // 指数バックオフ（デフォルト）
    return axiosRetry.exponentialDelay(retryCount, error)
  },
  // ...
})
```

## 根拠

### 設計変更の経緯

**初期設計での仮定（修正前）**:
- 当初、API_Meterが409 Conflictレスポンスを返すと仮定し、これを成功として扱う設計を検討していた
- HTTPセマンティクスとして、409は「既に処理済み」を示す標準的なパターン（Stripe等で採用）

**API_Meterチームからの確認（2025-12-04）**:
- **質問4: 409 Conflictは返されますか？**
  - **回答: 返さない。常に200 OKまたは4xx/5xx**
  - 冪等性は内部的にUPSERTで処理される
  - 初回送信・再送信ともに`200 OK`を返す
  - レスポンスボディに`inserted`（INSERT件数）と`updated`（UPDATE件数）が含まれる

**採用する設計**:
- 409 Conflict処理は不要（API_Meterが返さないため）
- 200 OKレスポンスで冪等性を判断（inserted=0, updated>0なら再送信）
- リトライ対象: 429（Rate Limit）、5xx（Server Error）のみ
- リトライしない: 4xx（400, 401, 403, 404, 422）

## 影響

### ポジティブな影響

- **冪等性の確実な保証**: API_Meter内部のUPSERTにより、重複送信を安全に処理
- **リトライの効率化**: 不要なリトライを削減し、API_Meter側の負荷を軽減
- **メトリクスの正確性**: 成功率が正確に計測され、監視が容易
- **スプール機構の効率化**: 200 OKで成功扱いのため、スプール再送の無駄を回避
- **ログの有用性**: レスポンスボディの`inserted`/`updated`で冪等性の動作を追跡可能

### ネガティブな影響

- **なし**: API_Meterチームの仕様確認により、409処理の複雑性が不要になった

### 中立的な影響

- **既存コードへの影響**: http-client.ts, external-api-sender.tsの変更が必要
- **テストの更新**: 200 OKレスポンスで`inserted`/`updated`を検証するテストケースを追加

## 実装への指針

### 原則

1. **200 OKレスポンスの詳細解析**
   - レスポンスボディの`inserted`/`updated`を記録
   - `inserted=0, updated>0`なら冪等性による再送信と判断
   - 成功カウントに含める（metrics.sendSuccess += records.length）

2. **リトライ条件の明確化**
   - 成功扱い: 200, 201, 204
   - リトライ対象: 429, 5xx, ネットワークエラー
   - リトライしない: 400, 401, 403, 404, 422

3. **指数バックオフの実装**
   - 1s → 2s → 4s（デフォルト）
   - Retry-Afterヘッダーを優先
   - 最大リトライ回数: 3回（環境変数で調整可能）

4. **エラーログの詳細化**
   - ステータスコード別にエラーメッセージを分類
   - レスポンスボディの詳細を記録
   - リトライカウントと遅延時間を記録

5. **テスト戦略**
   - 200 OKレスポンスで`inserted`/`updated`の検証テスト
   - リトライ条件のユニットテスト
   - 指数バックオフのシミュレーション
   - Retry-Afterヘッダーの尊重テスト

6. **監視とアラート**
   - `updated`の発生頻度を監視（異常に多い場合は調査）
   - リトライ回数の監視（上限到達の頻度を追跡）
   - 4xx/5xxエラーの分類別カウント

## 参考資料

- **API_Meterチーム確認事項（2025-12-04）**: 質問4「409 Conflictの有無」への回答
- [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) - HTTPステータスコードの公式定義
- [Exponential Backoff Algorithm](https://en.wikipedia.org/wiki/Exponential_backoff) - 指数バックオフのアルゴリズム
- [axios-retry Documentation](https://github.com/softonic/axios-retry) - axios-retryの公式ドキュメント

## 関連情報

- **関連ADR**:
  - ADR 002: リトライポリシー（既存のリトライ機構）
  - ADR 005: Retry-Afterヘッダー（Retry-Afterヘッダーの尊重）
  - ADR 014: 型システムの完全置き換え（ApiMeterRequestの送信）
  - ADR 016: 冪等性機構（source_event_idによる冪等性保証）
  - ADR 018: スプール機構統合（リトライ上限到達時のスプール保存）
