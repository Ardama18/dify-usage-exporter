# Dify Usage Exporter

Dify の使用量データを API_Meter に送信するツール。モデル別・ユーザー別・アプリ別の使用量集計をサポートし、スケジュール実行・リトライ機能・スプール機構を備えています。

## 特徴

- **複数の集計モード**: per_model（モデル別）、per_user（ユーザー別）、per_app（アプリ別）、workspace（ワークスペース全体）、all（全集計）
- **API_Meter 統合**: API_Meter 新仕様（2025-12-04版）に完全対応
- **正規化層**: プロバイダー名・モデル名の標準化
- **冪等性保証**: source_event_id による重複送信防止
- **スプールファイル機構**: 送信失敗時のデータ保持と自動リトライ
- **スケジュール実行**: cron形式でのバッチ実行サポート

## 必要要件

- Node.js 18.x 以上
- TypeScript 5.x 以上
- Dify API アクセス権限
- API_Meter アカウントとテナントID

## インストール

```bash
npm install
npm run build
```

## 環境変数

`.env` ファイルを作成し、以下の環境変数を設定してください。

### Dify API 設定

| 変数名 | 説明 | 必須 | デフォルト値 |
|-------|------|-----|------------|
| `DIFY_API_KEY` | Dify APIキー | ✓ | - |
| `DIFY_API_URL` | Dify APIエンドポイント | ✓ | - |
| `DIFY_WORKSPACE_ID` | Difyワークスペース ID | ✓ | - |
| `DIFY_START_DATE` | 集計開始日（YYYY-MM-DD） | | 前月1日 |
| `DIFY_END_DATE` | 集計終了日（YYYY-MM-DD） | | 前月末日 |
| `DIFY_AGGREGATION_PERIOD` | 集計周期（daily/weekly/monthly） | | daily |
| `DIFY_OUTPUT_MODE` | 出力モード（per_model/per_user/per_app/workspace/all） | | per_model |

### API_Meter 設定

| 変数名 | 説明 | 必須 | 形式 |
|-------|------|-----|------|
| `API_METER_TENANT_ID` | API_Meter テナント ID | ✓ | UUID |
| `API_METER_TOKEN` | API_Meter Bearer Token | ✓ | 文字列 |
| `API_METER_URL` | API_Meter エンドポイント URL | ✓ | URL |

### スケジュール設定

| 変数名 | 説明 | 必須 | デフォルト値 |
|-------|------|-----|------------|
| `SCHEDULE_ENABLED` | スケジュール実行の有効化 | | false |
| `SCHEDULE_CRON` | cron形式のスケジュール | | `0 1 * * *` |

### その他の設定

| 変数名 | 説明 | 必須 | デフォルト値 |
|-------|------|-----|------------|
| `LOG_LEVEL` | ログレベル（debug/info/warn/error） | | info |
| `MAX_RETRIES` | API送信リトライ回数 | | 3 |

### 環境変数の例

```bash
# Dify API
DIFY_API_KEY=your_dify_api_key
DIFY_API_URL=https://api.dify.ai
DIFY_WORKSPACE_ID=your_workspace_id
DIFY_START_DATE=2025-11-01
DIFY_END_DATE=2025-11-30
DIFY_AGGREGATION_PERIOD=daily
DIFY_OUTPUT_MODE=per_model

# API_Meter
API_METER_TENANT_ID=12345678-1234-1234-1234-123456789abc
API_METER_TOKEN=your_bearer_token
API_METER_URL=https://api.meter.example.com

# スケジュール（オプション）
SCHEDULE_ENABLED=true
SCHEDULE_CRON=0 1 * * *

# その他
LOG_LEVEL=info
MAX_RETRIES=3
```

## 使用方法

### 基本的な使用方法

```bash
npm run start
```

### per_model モード（推奨）

モデル別の使用量をAPI_Meterに送信します。

```bash
npm run start -- --mode per_model --date 2025-12-05
```

出力例:
```json
{
  "usage_date": "2025-12-05",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "input_tokens": 10000,
  "output_tokens": 5000,
  "total_tokens": 15000,
  "request_count": 25,
  "cost_actual": 0.105,
  "currency": "USD"
}
```

### all モード

全ての集計（モデル別・ユーザー別・アプリ別・ワークスペース全体）を一度に実行します。

```bash
npm run start -- --mode all --date 2025-12-05
```

### API_Meter 統合でサポートされていないモード

以下のモードは API_Meter 統合ではサポートされていません（ローカル集計のみ）:

- `per_user`: ユーザー別集計
- `per_app`: アプリ別集計
- `workspace`: ワークスペース全体集計

これらのモードを使用する場合、集計結果はログに出力されますが、API_Meter への送信はスキップされます。

### CLI オプション

```bash
npm run cli -- [options]

Options:
  --mode <mode>          集計モード (per_model/per_user/per_app/workspace/all)
  --date <date>          集計対象日（YYYY-MM-DD）
  --start-date <date>    集計開始日（YYYY-MM-DD）
  --end-date <date>      集計終了日（YYYY-MM-DD）
  --period <period>      集計周期（daily/weekly/monthly）
  --dry-run              ドライラン（API送信なし）
  -h, --help             ヘルプを表示
```

### スケジュール実行

毎日午前1時に前日のデータを送信する場合:

```bash
# .env
SCHEDULE_ENABLED=true
SCHEDULE_CRON=0 1 * * *

# 実行
npm run start
```

## データフロー

```
Fetch → Aggregate → Normalize → Transform → Send
  ↓          ↓           ↓           ↓         ↓
Dify API   集計処理    正規化処理   変換処理  API_Meter
```

1. **Fetch**: Dify API からデータ取得
2. **Aggregate**: モード別にデータ集計
3. **Normalize**: プロバイダー名・モデル名の標準化
4. **Transform**: API_Meter 形式への変換
5. **Send**: API_Meter への送信（リトライ・スプール保存）

## プロバイダー名の正規化

Dify 内部のプロバイダー名を API_Meter 標準名に変換します。

| Dify 内部名 | API_Meter 標準名 |
|-----------|----------------|
| aws-bedrock | aws |
| claude | anthropic |
| gemini | google |
| grok | xai |
| openai | openai |
| その他 | unknown |

## スプールファイル機構

送信失敗時、データはスプールファイルとして保存され、次回実行時に自動リトライされます。

- **スプールディレクトリ**: `data/spool/`
- **失敗ファイル**: `data/failed/`（変換失敗時）
- **最大リトライ回数**: 3回（環境変数 `MAX_RETRIES`）

## 冪等性保証

API_Meter への送信は冪等性が保証されます。

- **冪等性キー**: `(tenant_id, provider_id, model_id, usage_date)`
- **動作**: 同じデータを再送すると、API_Meter 側で上書き（UPSERT）
- **レスポンス**: 常に 200 OK（409 Conflict は返されない）

## 開発

### テスト実行

```bash
# 全テスト実行
npm run test

# ウォッチモード
npm run test:watch

# カバレッジ計測
npm run test:coverage

# 統合テスト
npm run test:integration

# E2Eテスト
npm run test:e2e
```

### コード品質チェック

```bash
# Biome チェック
npm run check

# フォーマット
npm run format

# Lint 修正
npm run lint:fix

# 全チェック
npm run check:all
```

## ライセンス

ISC

## バージョン履歴

詳細は [CHANGELOG.md](./CHANGELOG.md) を参照してください。
