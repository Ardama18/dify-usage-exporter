# 機能テスト仕様書・手順書

## 概要

本ドキュメントは、dify-usage-exporter（v1.2.0）について、人の手で実施する機能テストの仕様と手順を定義します。

**v1.2.0 の主な更新**:
- chat / completion モードのサポート追加（全5モードに対応）

---

## 1. テスト環境準備

### 1.1 必要な環境変数

テスト実行前に `.env` ファイルに以下の環境変数を設定してください。

```bash
# Dify API 設定
DIFY_API_BASE_URL=http://localhost
DIFY_EMAIL=your-email@example.com
DIFY_PASSWORD=your-password

# API_Meter 設定
API_METER_TENANT_ID=00000000-0000-0000-0000-000000000001
EXTERNAL_API_TOKEN=your-api-token
EXTERNAL_API_URL=http://localhost:3000/api/integrations/dify/usage-data/receive

# 取得期間設定
DIFY_FETCH_PERIOD=current_month  # today, yesterday, current_month, last_month

# オプション
LOG_LEVEL=debug
MAX_RETRIES=3
```

### 1.2 ビルド確認

```bash
# 依存パッケージのインストール
npm install

# ビルド
npm run build

# ビルド成功を確認（エラーがないこと）
echo $?  # 0 であること
```

### 1.3 自動テストの事前実行

機能テスト前に、自動テストがすべてパスすることを確認してください。

```bash
# 全テスト実行
npm run test

# 品質チェック（lint + build + test）
npm run check:all
```

**合格基準**: すべてのテストがパス、エラー0件

---

## 2. 実行方法

### 2.1 データ取得・送信（run-once.ts）

Difyからデータを取得してAPI_Meterに送信するには、以下のスクリプトを使用します。

```bash
# 手動実行スクリプト
npx tsx scripts/run-once.ts
```

取得期間は環境変数 `DIFY_FETCH_PERIOD` で制御します。

| 値 | 説明 |
|---|-----|
| `today` | 本日のデータのみ |
| `yesterday` | 昨日のデータのみ |
| `current_month` | 今月のデータ（デフォルト） |
| `last_month` | 先月のデータ |

### 2.2 CLI コマンド

CLIは以下のコマンドを提供します。

```bash
# ヘルプ表示
npm run cli -- --help

# 失敗ファイル一覧表示
npm run cli -- list

# 失敗ファイル再送
npm run cli -- resend --file <filename>
npm run cli -- resend --all

# ウォーターマーク管理
npm run cli -- watermark show
npm run cli -- watermark reset --date <ISO8601>
```

---

## 3. テスト項目一覧

| No. | カテゴリ | テスト項目 | 優先度 | 確認レベル |
|-----|---------|----------|-------|----------|
| T-01 | 基本動作 | データ取得・送信 | 必須 | L3（実機） |
| T-02 | 正規化 | プロバイダー名のクレンジング | 必須 | L2（ログ確認） |
| T-03 | 正規化 | モデル名のクレンジング | 必須 | L2（ログ確認） |
| T-04 | 認証 | Bearer Token 認証 | 必須 | L3（実機） |
| T-05 | エラー | 認証エラー（401） | 必須 | L2（ログ確認） |
| T-06 | 冪等性 | 同一データの再送（重複防止） | 必須 | L3（実機） |
| T-07 | エラー | バリデーションエラー（400） | 推奨 | L2（ログ確認） |
| T-08 | エラー | リトライ動作 | 推奨 | L2（ログ確認） |
| T-09 | スプール | 送信失敗時のスプール保存 | 推奨 | L1（ファイル確認） |
| T-10 | スプール | スプールファイルの再送 | 推奨 | L2（ログ確認） |
| T-11 | CLI | list コマンド | 推奨 | L1（出力確認） |
| T-12 | CLI | resend コマンド | 推奨 | L2（ログ確認） |
| T-13 | CLI | watermark コマンド | 推奨 | L1（ファイル確認） |

---

## 4. テスト手順

### T-01: データ取得・送信

**目的**: Difyからモデル別使用量を取得し、API_Meterに正常に送信されることを確認

**前提条件**:
- Dify に使用量データが存在すること
- API_Meter の認証情報が正しく設定されていること

**手順**:

1. 環境変数を設定
   ```bash
   export DIFY_FETCH_PERIOD=current_month
   export LOG_LEVEL=info
   ```

2. 実行
   ```bash
   npx tsx scripts/run-once.ts
   ```

3. ログ出力を確認
   ```
   期待するログ:
   - "実行開始"
   - "データ取得完了" (recordCount: X)
   - "データ集計完了"
   - "データ正規化完了"
   - "外部API送信完了" (status: 200)
   ```

4. API_Meter 管理画面で確認
   - 送信したレコードが表示されること
   - provider, model, usage_date が正しいこと

**合格基準**:
- [ ] 200 OK レスポンスを受信
- [ ] inserted/updated カウントがログに表示
- [ ] API_Meter 管理画面でデータが確認できる

**結果記録**:
| 項目 | 結果 | 備考 |
|------|------|------|
| 実行日時 | | |
| 取得期間 | | |
| レコード数 | | |
| レスポンス | | |
| inserted | | |
| updated | | |
| 確認者 | | |

---

### T-02: プロバイダー名のクレンジング

**目的**: Dify のプロバイダー名がクレンジング（小文字化・trim）されてそのまま転送されることを確認

**ADR 020: Exporter正規化層の責務削減**
- Exporter はマッピングを行わず、Dify データを忠実に転送
- クレンジング処理のみ実施（小文字化・trim・空文字→unknown）
- マッピング・正規化は API_Meter 側の責務

**確認対象のクレンジング**:

| Dify 内部名 | 期待する出力 | 処理内容 |
|-----------|------------|---------|
| OpenAI | openai | 小文字化 |
| ANTHROPIC | anthropic | 小文字化 |
| aws-bedrock | aws-bedrock | そのまま（マッピングなし） |
| claude | claude | そのまま（マッピングなし） |
| " gemini " | gemini | trim + 小文字化 |
| "" | unknown | 空文字は unknown |

**手順**:

1. LOG_LEVEL=debug に設定
   ```bash
   export LOG_LEVEL=debug
   ```

2. 実行してログを確認
   ```bash
   npx tsx scripts/run-once.ts 2>&1 | tee test-log.txt
   ```

3. ログからクレンジングを確認
   ```bash
   grep -i "provider" test-log.txt
   ```

4. API_Meter 管理画面で provider フィールドを確認

**合格基準**:
- [ ] aws-bedrock がそのまま aws-bedrock で送信されている（マッピングなし）
- [ ] 大文字が小文字に変換されている
- [ ] 空文字のプロバイダーのみ unknown になっている

**結果記録**:
| Dify プロバイダー | 正規化後 | 結果 |
|-----------------|---------|------|
| | | |

---

### T-03: モデル名のクレンジング

**目的**: モデル名がクレンジング（小文字化・trim）されてそのまま転送されることを確認

**ADR 020: Exporter正規化層の責務削減**
- Exporter はマッピングを行わず、Dify データを忠実に転送
- モデル名のバージョン番号付与は行わない（API_Meter 側の責務）

**確認対象のクレンジング例**:

| Dify モデル名 | 期待する出力 | 処理内容 |
|-------------|------------|---------|
| Claude-3-5-Sonnet | claude-3-5-sonnet | 小文字化 |
| GPT-4O | gpt-4o | 小文字化 |
| claude-3-5-sonnet-20241022 | claude-3-5-sonnet-20241022 | そのまま |
| " gpt-4 " | gpt-4 | trim |
| "" | unknown | 空文字は unknown |

**手順**:

1. 実行してログを確認
   ```bash
   npx tsx scripts/run-once.ts 2>&1 | grep -i "model"
   ```

2. API_Meter 管理画面で model フィールドを確認

**合格基準**:
- [ ] モデル名がそのまま転送されている（バージョン番号付与なし）
- [ ] 大文字が小文字に変換されている
- [ ] 空文字のモデル名のみ unknown になっている

---

### T-04: Bearer Token 認証

**目的**: API_Meter への送信が Bearer Token 認証で行われることを確認

**手順**:

1. 正しいトークンで送信
   ```bash
   npx tsx scripts/run-once.ts
   ```

2. 200 OK が返ることを確認

**合格基準**:
- [ ] 200 OK レスポンスを受信
- [ ] Authorization ヘッダーに Bearer Token が含まれている（ログで確認）

---

### T-05: 認証エラー（401）

**目的**: 不正なトークンで 401 エラーが正しくハンドリングされることを確認

**手順**:

1. 一時的に不正なトークンを設定
   ```bash
   export EXTERNAL_API_TOKEN=invalid-token
   ```

2. 送信を実行
   ```bash
   npx tsx scripts/run-once.ts
   ```

3. ログを確認
   ```
   期待するログ:
   - "401" または "Unauthorized"
   - エラーメッセージが出力される
   ```

4. 元のトークンに戻す
   ```bash
   export EXTERNAL_API_TOKEN=correct-token
   ```

**合格基準**:
- [ ] 401 エラーがログに出力される
- [ ] プロセスがクラッシュしない（適切にエラーハンドリングされる）

---

### T-06: 冪等性（同一データの再送）

**目的**: 同じデータを複数回送信しても重複が発生しないことを確認

**手順**:

1. 同じデータを2回送信
   ```bash
   npx tsx scripts/run-once.ts
   npx tsx scripts/run-once.ts
   ```

2. ログを確認
   ```
   期待するログ（2回目）:
   - "200 OK" または status: 200
   - "inserted: 0, updated: X" または同等の表示
   ```

3. API_Meter 管理画面で確認
   - レコード数が増えていないこと
   - updated_at が更新されていること

**合格基準**:
- [ ] 2回目の送信で inserted: 0 となる（または updated のみ）
- [ ] API_Meter 上のレコード数が増えない
- [ ] source_event_id が同一であること

---

### T-07: バリデーションエラー（400）

**目的**: 不正なデータで 400 エラーが正しくハンドリングされることを確認

**手順**:

1. API_Meter 側でバリデーションエラーが発生する状況を作成
   （例：tenant_id を不正な形式に変更）

2. 送信を実行

3. ログを確認
   ```
   期待するログ:
   - "400" または "Bad Request"
   - エラー詳細が出力される
   ```

**合格基準**:
- [ ] 400 エラーがログに出力される
- [ ] エラー詳細が確認できる

---

### T-08: リトライ動作

**目的**: 5xx エラー時にリトライが実行されることを確認

**手順**:

1. API_Meter が 5xx を返す状況を作成
   （例：API_Meter サーバーを一時停止）

2. 送信を実行
   ```bash
   npx tsx scripts/run-once.ts
   ```

3. ログを確認
   ```
   期待するログ:
   - リトライ試行のログ
   - 最終的なエラーログ
   ```

**合格基準**:
- [ ] 指定回数のリトライが実行される
- [ ] リトライ失敗後にエラーログが出力される

---

### T-09: 送信失敗時のスプール保存

**目的**: 送信失敗時にスプールファイルが正しく保存されることを確認

**注意**: run-once.ts スクリプトはスプール保存機能を持ちません。この機能はスケジューラ経由での実行時のみ動作します。

**手順**:

1. スプールディレクトリを確認
   ```bash
   ls -la data/spool/
   ls -la data/failed/
   ```

**合格基準**:
- [ ] スケジューラ実行時に送信失敗すると data/spool/ にファイルが保存される
- [ ] ファイル内容が ApiMeterRequest 形式である
- [ ] version フィールドが "2.0.0" である

---

### T-10: スプールファイルの再送

**目的**: CLI でスプールファイルを再送できることを確認

**手順**:

1. 失敗ファイルが存在することを確認
   ```bash
   npm run cli -- list
   ```

2. ファイルを再送
   ```bash
   npm run cli -- resend --file <filename>
   # または
   npm run cli -- resend --all
   ```

3. ログを確認

**合格基準**:
- [ ] スプールファイルが再送される
- [ ] 成功後にスプールファイルが削除される

---

### T-11: list コマンド

**目的**: 失敗ファイル一覧が正しく表示されることを確認

**手順**:

1. 実行
   ```bash
   npm run cli -- list
   ```

2. 出力を確認
   - ファイル名、レコード数、作成日時が表示されること
   - ファイルがない場合は "No failed files" が表示されること

**合格基準**:
- [ ] 失敗ファイル一覧が正しく表示される
- [ ] ファイルがない場合に適切なメッセージが表示される

---

### T-12: resend コマンド

**目的**: 失敗ファイルの再送が正しく動作することを確認

**手順**:

1. 失敗ファイルを確認
   ```bash
   npm run cli -- list
   ```

2. 特定ファイルを再送
   ```bash
   npm run cli -- resend --file <filename>
   ```

3. 全ファイルを再送
   ```bash
   npm run cli -- resend --all
   ```

**合格基準**:
- [ ] 指定したファイルが再送される
- [ ] --all で全ファイルが再送される
- [ ] 成功時にファイルが削除される

---

### T-13: watermark コマンド

**目的**: ウォーターマーク管理が正しく動作することを確認

**手順**:

1. 現在のウォーターマークを表示
   ```bash
   npm run cli -- watermark show
   ```

2. ウォーターマークをリセット
   ```bash
   npm run cli -- watermark reset --date 2025-12-01T00:00:00.000Z
   ```

3. 確認プロンプトで "y" を入力

4. リセット後の値を確認
   ```bash
   npm run cli -- watermark show
   ```

**合格基準**:
- [ ] show で現在の値が表示される
- [ ] reset で確認プロンプトが表示される
- [ ] リセット後に新しい値が反映される

---

## 5. テスト結果サマリー

### 必須テスト項目

| No. | テスト項目 | 結果 | 実施日 | 確認者 |
|-----|----------|------|-------|-------|
| T-01 | データ取得・送信 | | | |
| T-02 | プロバイダー名のクレンジング | | | |
| T-03 | モデル名のクレンジング | | | |
| T-04 | Bearer Token 認証 | | | |
| T-05 | 認証エラー（401） | | | |
| T-06 | 冪等性（同一データの再送） | | | |

### 推奨テスト項目

| No. | テスト項目 | 結果 | 実施日 | 確認者 |
|-----|----------|------|-------|-------|
| T-07 | バリデーションエラー（400） | | | |
| T-08 | リトライ動作 | | | |
| T-09 | 送信失敗時のスプール保存 | | | |
| T-10 | スプールファイルの再送 | | | |
| T-11 | list コマンド | | | |
| T-12 | resend コマンド | | | |
| T-13 | watermark コマンド | | | |

---

## 6. トラブルシューティング

### よくある問題と対処法

#### 問題1: "Cannot find module" エラー

```bash
# 解決策
npm run build
```

#### 問題2: 401 Unauthorized エラー

```bash
# 確認事項
echo $EXTERNAL_API_TOKEN
echo $API_METER_TENANT_ID

# トークンの再設定
export EXTERNAL_API_TOKEN=correct-token
```

#### 問題3: ネットワークエラー

```bash
# 接続確認
curl -I $EXTERNAL_API_URL

# プロキシ設定確認
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

#### 問題4: Dify データが取得できない

```bash
# 認証情報確認
echo $DIFY_EMAIL
echo $DIFY_API_BASE_URL

# 期間設定確認
echo $DIFY_FETCH_PERIOD
```

---

## 7. 付録

### 7.1 ログレベルの設定

| レベル | 用途 |
|-------|------|
| error | エラーのみ |
| warn | 警告以上 |
| info | 通常運用（デフォルト） |
| debug | 詳細ログ（テスト時推奨） |

```bash
export LOG_LEVEL=debug
```

### 7.2 テストデータの確認

API_Meter に送信されるデータ形式:

**注意**: ADR 020 により、provider/model はマッピングなしで Dify のデータをそのまま転送します。

```json
{
  "tenant_id": "12345678-1234-1234-1234-123456789abc",
  "export_metadata": {
    "exporter_version": "1.1.0",
    "export_timestamp": "2025-12-06T10:00:00.000Z",
    "aggregation_period": "daily",
    "source_system": "dify",
    "date_range": {
      "start": "2025-12-06T00:00:00.000Z",
      "end": "2025-12-06T00:00:00.000Z"
    }
  },
  "records": [
    {
      "usage_date": "2025-12-06",
      "provider": "openai",
      "model": "gpt-4o",
      "input_tokens": 10000,
      "output_tokens": 5000,
      "total_tokens": 15000,
      "request_count": 1,
      "cost_actual": 0.105,
      "currency": "USD",
      "metadata": {
        "source_system": "dify",
        "source_event_id": "sha256-hash-here",
        "source_app_id": "app-123",
        "aggregation_method": "daily_sum"
      }
    }
  ]
}
```

**provider/model の値について**:
- Dify から取得した値をクレンジング（小文字化・trim）してそのまま転送
- マッピング・正規化は API_Meter 側で実施

### 7.3 対応アプリモード

dify-usage-exporter は以下の Dify アプリモードに対応しています。

| アプリモード | 対応状況 | 取得方法 |
|------------|---------|---------|
| workflow | ✅ 対応 | `/workflow-runs` → `/node-executions` |
| advanced-chat | ✅ 対応 | `/conversations` → `/messages` → `/node-executions` |
| agent-chat | ✅ 対応 | `/conversations` → `/messages` → `/node-executions` |
| chat | ✅ 対応 | `/apps/{id}` → `/statistics/token-costs` |
| completion | ✅ 対応 | `/apps/{id}` → `/statistics/token-costs` |

**各モードの取得方式**:

1. **workflow / advanced-chat / agent-chat モード**:
   - ワークフローのノード実行（`/node-executions`）から詳細なモデル別使用量を取得
   - 入力/出力トークン数、プロバイダー、モデル名、コストを個別に取得可能

2. **chat / completion モード（v1.2.0で追加）**:
   - ワークフローを使用しないため、アプリ単位でトークン使用量を取得
   - アプリ = モデルの1:1マッピング（1つのアプリは1つのモデルを使用）
   - `/apps/{id}` APIでモデル設定を取得し、`/statistics/token-costs` APIで日次使用量を取得
   - 入力/出力トークンの内訳はなく、合計トークン数のみ取得可能
   - ユーザー別の内訳はなく、アプリ全体の集計値として記録

---

**ドキュメントバージョン**: 1.3.0
**作成日**: 2025-12-07
**更新日**: 2025-12-14
**対象バージョン**: dify-usage-exporter v1.2.0
**関連ADR**: ADR 020 - Exporter正規化層の責務削減とデータ忠実性の確保
