# 外部API インターフェース仕様書

## 1. 概要

本ドキュメントは、Dify Usage Exporterが外部APIに対して送信するデータのインターフェース仕様を定義します。

### 1.1 システム構成

```
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│                     │      │                     │      │                     │
│   Dify Platform     │─────▶│  Dify Usage         │─────▶│   外部API           │
│   (データソース)     │      │  Exporter           │      │   (受信側)          │
│                     │      │                     │      │                     │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
```

### 1.2 通信方式

| 項目 | 値 |
|------|-----|
| プロトコル | HTTPS（必須） |
| メソッド | POST |
| Content-Type | application/json |
| 認証方式 | Bearer Token |
| タイムアウト | 30秒（デフォルト、設定変更可） |
| リトライ | 最大3回（指数バックオフ） |

---

## 2. エンドポイント

### 2.1 リクエスト

```
POST {EXTERNAL_API_URL}
```

### 2.2 リクエストヘッダー

| ヘッダー名 | 値 | 必須 |
|-----------|-----|------|
| Content-Type | application/json | ✅ |
| Authorization | Bearer {EXTERNAL_API_TOKEN} | ✅ |

### 2.3 リクエストボディ

```json
{
  "aggregation_period": "monthly",
  "output_mode": "both",
  "fetch_period": {
    "start": "2025-11-01T00:00:00.000Z",
    "end": "2025-11-30T00:00:00.000Z"
  },
  "app_records": [...],
  "workspace_records": [...]
}
```

---

## 3. リクエストボディ詳細

### 3.1 トップレベルフィールド

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| aggregation_period | string | ✅ | 集計周期（`monthly` / `weekly` / `daily`） |
| output_mode | string | ✅ | 出力モード（`per_app` / `workspace` / `both`） |
| fetch_period | object | ✅ | データ取得期間 |
| app_records | array | ✅ | アプリ別集計レコード（output_modeに応じて空配列の場合あり） |
| workspace_records | array | ✅ | ワークスペース全体集計レコード（output_modeに応じて空配列の場合あり） |

### 3.2 aggregation_period（集計周期）

| 値 | 説明 | periodフォーマット |
|-----|------|-------------------|
| `monthly` | 月単位で集計 | `YYYY-MM`（例: `2025-11`） |
| `weekly` | 週単位で集計（ISO 8601） | `YYYY-Www`（例: `2025-W48`） |
| `daily` | 日単位で集計 | `YYYY-MM-DD`（例: `2025-11-29`） |

### 3.3 output_mode（出力モード）

| 値 | 説明 | app_records | workspace_records |
|-----|------|-------------|-------------------|
| `per_app` | アプリ毎のみ | データあり | 空配列 |
| `workspace` | ワークスペース全体のみ | 空配列 | データあり |
| `both` | 両方 | データあり | データあり |

### 3.4 fetch_period（取得期間）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| start | string | 取得期間の開始日時（ISO 8601形式） |
| end | string | 取得期間の終了日時（ISO 8601形式） |

```json
{
  "start": "2025-11-01T00:00:00.000Z",
  "end": "2025-11-30T00:00:00.000Z"
}
```

### 3.5 app_records（アプリ別集計レコード）

アプリ毎・集計期間毎のトークン使用量を格納します。

| フィールド | 型 | 説明 | 例 |
|-----------|-----|------|-----|
| period | string | 集計期間（aggregation_periodに応じた形式） | `"2025-11"` |
| period_type | string | 集計周期タイプ | `"monthly"` |
| app_id | string | DifyアプリのユニークID | `"abc123-def456"` |
| app_name | string | Difyアプリの表示名 | `"顧客対応Bot"` |
| token_count | integer | 使用トークン数（合計） | `125000` |
| total_price | string | 合計金額（小数点以下7桁） | `"1.2345678"` |
| currency | string | 通貨コード | `"USD"` |

**サンプル:**

```json
{
  "period": "2025-11",
  "period_type": "monthly",
  "app_id": "abc123-def456-789",
  "app_name": "顧客対応Bot",
  "token_count": 125000,
  "total_price": "1.2345678",
  "currency": "USD"
}
```

### 3.6 workspace_records（ワークスペース全体集計レコード）

ワークスペース全体（全アプリ合算）の集計期間毎のトークン使用量を格納します。

| フィールド | 型 | 説明 | 例 |
|-----------|-----|------|-----|
| period | string | 集計期間（aggregation_periodに応じた形式） | `"2025-11"` |
| period_type | string | 集計周期タイプ | `"monthly"` |
| type | string | レコードタイプ（固定値） | `"workspace_total"` |
| token_count | integer | 使用トークン数（全アプリ合計） | `500000` |
| total_price | string | 合計金額（小数点以下7桁） | `"5.0000000"` |
| currency | string | 通貨コード | `"USD"` |

**サンプル:**

```json
{
  "period": "2025-11",
  "period_type": "monthly",
  "type": "workspace_total",
  "token_count": 500000,
  "total_price": "5.0000000",
  "currency": "USD"
}
```

---

## 4. 完全なリクエスト例

### 4.1 月次・両方出力（output_mode: both）

```json
{
  "aggregation_period": "monthly",
  "output_mode": "both",
  "fetch_period": {
    "start": "2025-11-01T00:00:00.000Z",
    "end": "2025-11-30T00:00:00.000Z"
  },
  "app_records": [
    {
      "period": "2025-11",
      "period_type": "monthly",
      "app_id": "abc123-def456-789",
      "app_name": "顧客対応Bot",
      "token_count": 125000,
      "total_price": "1.2500000",
      "currency": "USD"
    },
    {
      "period": "2025-11",
      "period_type": "monthly",
      "app_id": "xyz789-uvw456-123",
      "app_name": "FAQ検索システム",
      "token_count": 75000,
      "total_price": "0.7500000",
      "currency": "USD"
    }
  ],
  "workspace_records": [
    {
      "period": "2025-11",
      "period_type": "monthly",
      "type": "workspace_total",
      "token_count": 200000,
      "total_price": "2.0000000",
      "currency": "USD"
    }
  ]
}
```

### 4.2 週次・アプリ別のみ（output_mode: per_app）

```json
{
  "aggregation_period": "weekly",
  "output_mode": "per_app",
  "fetch_period": {
    "start": "2025-11-25T00:00:00.000Z",
    "end": "2025-12-01T00:00:00.000Z"
  },
  "app_records": [
    {
      "period": "2025-W48",
      "period_type": "weekly",
      "app_id": "abc123-def456-789",
      "app_name": "顧客対応Bot",
      "token_count": 30000,
      "total_price": "0.3000000",
      "currency": "USD"
    }
  ],
  "workspace_records": []
}
```

### 4.3 日次・ワークスペースのみ（output_mode: workspace）

```json
{
  "aggregation_period": "daily",
  "output_mode": "workspace",
  "fetch_period": {
    "start": "2025-11-29T00:00:00.000Z",
    "end": "2025-11-29T23:59:59.999Z"
  },
  "app_records": [],
  "workspace_records": [
    {
      "period": "2025-11-29",
      "period_type": "daily",
      "type": "workspace_total",
      "token_count": 10000,
      "total_price": "0.1000000",
      "currency": "USD"
    }
  ]
}
```

---

## 5. レスポンス仕様

### 5.1 成功レスポンス

| HTTPステータス | 説明 |
|---------------|------|
| 200 OK | リクエスト成功 |
| 201 Created | リクエスト成功（データ作成） |
| 204 No Content | リクエスト成功（レスポンスボディなし） |

**推奨レスポンス形式:**

```json
{
  "success": true,
  "message": "Data received successfully",
  "received_at": "2025-11-29T10:30:00.000Z"
}
```

### 5.2 エラーレスポンス

| HTTPステータス | 説明 | Exporter側の動作 |
|---------------|------|-----------------|
| 400 Bad Request | リクエスト不正 | リトライなし、エラーログ出力 |
| 401 Unauthorized | 認証エラー | リトライなし、エラーログ出力 |
| 403 Forbidden | 権限エラー | リトライなし、エラーログ出力 |
| 404 Not Found | エンドポイント不存在 | リトライなし、エラーログ出力 |
| 409 Conflict | 重複データ | **成功扱い**（冪等性対応） |
| 429 Too Many Requests | レート制限 | リトライあり（バックオフ） |
| 500 Internal Server Error | サーバーエラー | リトライあり |
| 502 Bad Gateway | ゲートウェイエラー | リトライあり |
| 503 Service Unavailable | サービス停止 | リトライあり |
| 504 Gateway Timeout | タイムアウト | リトライあり |

### 5.3 409 Conflict の特別扱い

外部APIが同一データの重複送信を検知した場合、`409 Conflict`を返すことで、Exporter側は「既に処理済み」と判断し、成功扱いとします。これにより冪等性が保証されます。

---

## 6. リトライポリシー

### 6.1 リトライ条件

以下のケースでリトライを実行します：

- HTTPステータス: 429, 500, 502, 503, 504
- ネットワークエラー（接続タイムアウト等）

### 6.2 リトライ設定

| 項目 | デフォルト値 | 環境変数 |
|------|-------------|----------|
| 最大リトライ回数 | 3回 | `MAX_RETRIES` |
| 初回リトライ遅延 | 1秒 | - |
| バックオフ係数 | 2倍 | - |
| 最大遅延 | 30秒 | - |

**リトライ間隔例:** 1秒 → 2秒 → 4秒

### 6.3 リトライ失敗時

リトライ上限に達した場合、データはスプールファイルに保存され、次回実行時に再送を試みます。

---

## 7. セキュリティ要件

### 7.1 必須要件

| 項目 | 要件 |
|------|------|
| プロトコル | HTTPS必須（HTTP不可） |
| TLSバージョン | TLS 1.2以上 |
| 認証 | Bearer Token（後述） |

### 7.2 Bearer Token認証について

Exporter側は**常に**以下のヘッダーを送信します：

```
Authorization: Bearer {EXTERNAL_API_TOKEN}
```

**外部API側での扱い:**

| 対応方法 | 説明 | ユースケース |
|----------|------|-------------|
| **検証する（推奨）** | トークンを照合し、不一致なら401を返す | 本番環境、セキュリティ重視 |
| **無視する** | ヘッダーは受信するが検証しない | テスト環境、社内ネットワーク内 |

外部API側でトークン検証を**実装するかどうかは任意**です。Exporterは設定されたトークンを常に送信しますが、受信側がそれをどう扱うかは外部APIの実装次第となります。

**検証する場合の実装例:**

```typescript
// 外部API側
app.post('/api/dify-usage', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (token !== process.env.EXPECTED_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // データ処理...
  res.status(200).json({ success: true })
})
```

### 7.3 推奨事項

- 本番環境ではトークン検証を実装
- トークンの定期ローテーション
- IPホワイトリストによるアクセス制限
- リクエストログの保存（監査用）


## 8. 設定パラメータ一覧

Exporter側で設定可能なパラメータ：

| 環境変数 | 説明 | デフォルト値 | 必須 |
|----------|------|-------------|------|
| `EXTERNAL_API_URL` | 送信先エンドポイントURL | - | ✅ |
| `EXTERNAL_API_TOKEN` | Bearer認証トークン | - | ✅ |
| `EXTERNAL_API_TIMEOUT_MS` | タイムアウト（ミリ秒） | 30000 | - |
| `MAX_RETRIES` | 最大リトライ回数 | 3 | - |
| `DIFY_FETCH_PERIOD` | 取得期間モード | current_month | - |
| `DIFY_AGGREGATION_PERIOD` | 集計周期 | monthly | - |
| `DIFY_OUTPUT_MODE` | 出力モード | per_app | - |
| `CRON_SCHEDULE` | 実行スケジュール（cron形式） | 0 0 * * * | - |

### 9.1 DIFY_FETCH_PERIOD の値

| 値 | 説明 |
|-----|------|
| `current_month` | 今月 |
| `last_month` | 先月 |
| `current_week` | 今週（月曜始まり） |
| `last_week` | 先週 |
| `custom` | カスタム（START_DATE/END_DATE指定） |



## 11. 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 1.0.0 | 2025-11-29 | 初版作成 |

---

## 12. 問い合わせ先

本仕様に関する質問・要望は、プロジェクト担当者までご連絡ください。
