# 外部API インターフェース仕様書

## 概要

Dify Usage Exporterは、定期実行時に以下のHTTPリクエストを外部APIへ送信します。

---

## リクエスト仕様

### エンドポイント

```
POST {EXTERNAL_API_URL}
```

環境変数 `EXTERNAL_API_URL` で指定されたURLに送信します。

### ヘッダー

| ヘッダー名 | 値 |
|-----------|-----|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {EXTERNAL_API_TOKEN}` |

### リクエストボディ

```json
{
  "records": [
    {
      "date": "2025-11-29",
      "app_id": "dc279ec4-0860-46e2-a789-d4b4238443de",
      "app_name": "DeepResearch + Word/PowerPoint",
      "token_count": 9162,
      "total_price": "0.0197304",
      "currency": "USD",
      "idempotency_key": "2025-11-29_dc279ec4-0860-46e2-a789-d4b4238443de",
      "transformed_at": "2025-11-29T09:07:01.158Z"
    },
    {
      "date": "2025-11-29",
      "app_id": "0d9bcb69-eff6-49c9-b7c0-3e30f808ad25",
      "app_name": "ファイル添付テスト",
      "token_count": 500,
      "total_price": "0.005",
      "currency": "USD",
      "idempotency_key": "2025-11-29_0d9bcb69-eff6-49c9-b7c0-3e30f808ad25",
      "transformed_at": "2025-11-29T09:07:01.158Z"
    }
  ]
}
```

### フィールド定義

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `date` | string | ○ | 使用日（YYYY-MM-DD形式） |
| `app_id` | string | ○ | DifyアプリのユニークID |
| `app_name` | string | ○ | Difyアプリの表示名 |
| `token_count` | number | ○ | 使用トークン数（整数） |
| `total_price` | string | ○ | 合計金額（小数点以下の精度を保持するため文字列） |
| `currency` | string | ○ | 通貨コード（通常 "USD"） |
| `idempotency_key` | string | ○ | 冪等キー（重複送信防止用） |
| `transformed_at` | string | ○ | 変換日時（ISO 8601形式） |

### 冪等キーの形式

```
{date}_{app_id}
```

例: `2025-11-29_dc279ec4-0860-46e2-a789-d4b4238443de`

同じ日付・同じアプリのデータは同一の冪等キーを持つため、受信側で重複処理を防止できます。

---

## レスポンス仕様

### 成功時

| ステータスコード | 説明 |
|-----------------|------|
| `200 OK` | 正常に受信 |
| `201 Created` | 正常に作成 |
| `202 Accepted` | 非同期処理として受け付け |

### エラー時

| ステータスコード | 説明 | Exporter側の動作 |
|-----------------|------|-----------------|
| `400 Bad Request` | リクエスト形式エラー | エラーログ出力、リトライなし |
| `401 Unauthorized` | 認証エラー | エラーログ出力、リトライなし |
| `429 Too Many Requests` | レート制限 | リトライ（Retry-After考慮） |
| `5xx` | サーバーエラー | リトライ |

---

## 実際のHTTPリクエスト例

### curlでの再現

```bash
curl -X POST "https://your-external-api.com/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "records": [
      {
        "date": "2025-11-29",
        "app_id": "dc279ec4-0860-46e2-a789-d4b4238443de",
        "app_name": "DeepResearch + Word/PowerPoint",
        "token_count": 9162,
        "total_price": "0.0197304",
        "currency": "USD",
        "idempotency_key": "2025-11-29_dc279ec4-0860-46e2-a789-d4b4238443de",
        "transformed_at": "2025-11-29T09:07:01.158Z"
      }
    ]
  }'
```

---

## 定期実行時の動作

### タイムライン

```
[CRON時刻到達]
    ↓
[Difyログイン] ← Cookie認証
    ↓
[アプリ一覧取得] ← GET /console/api/apps
    ↓
[各アプリのトークンコスト取得] ← GET /console/api/apps/{id}/statistics/token-costs
    ↓
[データ変換] ← 冪等キー生成
    ↓
[外部API送信] ← POST {EXTERNAL_API_URL}  ★ここで送信
    ↓
[ウォーターマーク更新]
    ↓
[ジョブ完了]
```

### 送信タイミング

- 初回実行時: 過去30日分のデータを送信
- 2回目以降: 前回実行以降の新規データのみ送信
- データがない場合: 送信しない（「送信するデータがありません」ログ）

### 送信頻度

環境変数 `CRON_SCHEDULE` で設定（デフォルト: 毎日0時）

---

## 受信側の実装ガイド

### 推奨実装

```python
# Python Flask での受信例
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def receive_usage_data():
    # 認証チェック
    auth = request.headers.get('Authorization')
    if auth != 'Bearer your-expected-token':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    records = data.get('records', [])

    for record in records:
        # 冪等キーで重複チェック
        if is_duplicate(record['idempotency_key']):
            continue

        # データ保存
        save_record(
            date=record['date'],
            app_id=record['app_id'],
            app_name=record['app_name'],
            token_count=record['token_count'],
            total_price=float(record['total_price']),
            currency=record['currency']
        )

        # 冪等キーを記録
        mark_processed(record['idempotency_key'])

    return jsonify({'status': 'ok', 'processed': len(records)}), 200
```

### 重複処理の防止

`idempotency_key` を使って重複を防止してください：

1. 受信時に `idempotency_key` をDBで検索
2. 存在すれば処理をスキップ
3. 存在しなければ処理して `idempotency_key` を保存

---

## テスト用エンドポイント

webhook.site を使ってテスト可能：

1. https://webhook.site にアクセス
2. 一意のURLを取得
3. `EXTERNAL_API_URL` に設定
4. Exporterを実行
5. webhook.siteで受信データを確認
