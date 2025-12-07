# 機能テスト仕様書・手順書

## 概要

本ドキュメントは、dify-usage-exporter の API_Meter 新仕様対応（v1.1.0）について、人の手で実施する機能テストの仕様と手順を定義します。

---

## 1. テスト環境準備

### 1.1 必要な環境変数

テスト実行前に `.env` ファイルに以下の環境変数を設定してください。

```bash
# Dify API 設定
DIFY_API_URL=https://your-dify-instance.example.com
DIFY_CONSOLE_USER_EMAIL=your-email@example.com
DIFY_CONSOLE_USER_PASSWORD=your-password
DIFY_WORKSPACE_ID=your-workspace-id

# API_Meter 設定
API_METER_TENANT_ID=12345678-1234-1234-1234-123456789abc
API_METER_TOKEN=your-bearer-token
API_METER_URL=https://api.meter.example.com

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

# 品質チェック
npm run check:all
```

**合格基準**: すべてのテストがパス、エラー0件

---

## 2. テスト項目一覧

| No. | カテゴリ | テスト項目 | 優先度 | 確認レベル |
|-----|---------|----------|-------|----------|
| T-01 | 基本動作 | per_model モードでの送信 | 必須 | L3（実機） |
| T-02 | 基本動作 | all モードでの送信 | 必須 | L3（実機） |
| T-03 | 正規化 | プロバイダー名の正規化 | 必須 | L2（ログ確認） |
| T-04 | 正規化 | モデル名の標準化 | 必須 | L2（ログ確認） |
| T-05 | 認証 | Bearer Token 認証 | 必須 | L3（実機） |
| T-06 | エラー | 認証エラー（401） | 必須 | L2（ログ確認） |
| T-07 | エラー | バリデーションエラー（400） | 推奨 | L2（ログ確認） |
| T-08 | エラー | リトライ動作 | 推奨 | L2（ログ確認） |
| T-09 | スプール | 送信失敗時のスプール保存 | 推奨 | L1（ファイル確認） |
| T-10 | スプール | スプールファイルの再送 | 推奨 | L2（ログ確認） |
| T-11 | 冪等性 | 同一データの再送（重複防止） | 必須 | L3（実機） |
| T-12 | CLI | --dry-run オプション | 推奨 | L1（ログ確認） |
| T-13 | CLI | --date オプション | 必須 | L2（ログ確認） |
| T-14 | 非対応モード | per_user モードのスキップ | 推奨 | L2（ログ確認） |

---

## 3. テスト手順

### T-01: per_model モードでの送信

**目的**: モデル別使用量が API_Meter に正常に送信されることを確認

**前提条件**:
- Dify に使用量データが存在する日付を指定
- API_Meter の認証情報が正しく設定されている

**手順**:

1. テスト対象日を決定（例: 2025-12-06）
   ```bash
   # Dify にデータがある日付を確認
   npm run cli -- --mode per_model --date 2025-12-06 --dry-run
   ```

2. 実際に送信を実行
   ```bash
   npm run cli -- --mode per_model --date 2025-12-06
   ```

3. ログ出力を確認
   ```
   期待するログ:
   - "[Sender] Sending X records to API_Meter"
   - "[Sender] API_Meter response: 200 OK"
   - "inserted: X, updated: Y"
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
| 対象日 | | |
| レコード数 | | |
| レスポンス | | |
| inserted | | |
| updated | | |
| 確認者 | | |

---

### T-02: all モードでの送信

**目的**: 全集計モード（per_model + per_user + per_app + workspace）が正常に動作することを確認

**手順**:

1. all モードで実行
   ```bash
   npm run cli -- --mode all --date 2025-12-06
   ```

2. ログ出力を確認
   ```
   期待するログ:
   - "Starting aggregation in 'all' mode"
   - "per_model: X records"
   - "[Sender] Sending X records to API_Meter"
   - "per_user mode is not supported for API_Meter - skipping"
   - "per_app mode is not supported for API_Meter - skipping"
   - "workspace mode is not supported for API_Meter - skipping"
   ```

**合格基準**:
- [ ] per_model のデータが API_Meter に送信される
- [ ] per_user/per_app/workspace はスキップログが出力される
- [ ] エラーなく完了する

**結果記録**:
| 項目 | 結果 | 備考 |
|------|------|------|
| 実行日時 | | |
| per_model 送信数 | | |
| スキップ確認 | | |
| 確認者 | | |

---

### T-03: プロバイダー名のクレンジング

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
   npm run cli -- --mode per_model --date 2025-12-06 2>&1 | tee test-log.txt
   ```

3. ログからクレンジングを確認
   ```bash
   grep -i "provider" test-log.txt
   grep -i "cleansing" test-log.txt
   ```

**合格基準**:
- [ ] aws-bedrock がそのまま aws-bedrock で送信されている（マッピングなし）
- [ ] 大文字が小文字に変換されている
- [ ] 空文字のプロバイダーのみ unknown になっている

**結果記録**:
| Dify プロバイダー | 正規化後 | 結果 |
|-----------------|---------|------|
| | | |

---

### T-04: モデル名のクレンジング

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
   npm run cli -- --mode per_model --date 2025-12-06 2>&1 | grep -i "model"
   ```

2. API_Meter 管理画面で model フィールドを確認

**合格基準**:
- [ ] モデル名がそのまま転送されている（バージョン番号付与なし）
- [ ] 大文字が小文字に変換されている
- [ ] 空文字のモデル名のみ unknown になっている

---

### T-05: Bearer Token 認証

**目的**: API_Meter への送信が Bearer Token 認証で行われることを確認

**手順**:

1. 正しいトークンで送信
   ```bash
   npm run cli -- --mode per_model --date 2025-12-06
   ```

2. 200 OK が返ることを確認

**合格基準**:
- [ ] 200 OK レスポンスを受信
- [ ] Authorization ヘッダーに Bearer Token が含まれている（ログで確認）

---

### T-06: 認証エラー（401）

**目的**: 不正なトークンで 401 エラーが正しくハンドリングされることを確認

**手順**:

1. 一時的に不正なトークンを設定
   ```bash
   export API_METER_TOKEN=invalid-token
   ```

2. 送信を実行
   ```bash
   npm run cli -- --mode per_model --date 2025-12-06
   ```

3. ログを確認
   ```
   期待するログ:
   - "401 Unauthorized"
   - "Authentication failed"
   - スプールファイルが保存される
   ```

4. 元のトークンに戻す
   ```bash
   export API_METER_TOKEN=correct-token
   ```

**合格基準**:
- [ ] 401 エラーがログに出力される
- [ ] スプールファイルが data/spool/ に保存される
- [ ] プロセスがクラッシュしない

---

### T-07: バリデーションエラー（400）

**目的**: 不正なデータで 400 エラーが正しくハンドリングされることを確認

**手順**:

1. テストデータを人為的に不正にする（開発者モード）

2. 送信を実行

3. ログを確認
   ```
   期待するログ:
   - "400 Bad Request"
   - "Validation error"
   - スプールファイルが保存される
   ```

**合格基準**:
- [ ] 400 エラーがログに出力される
- [ ] スプールファイルが data/spool/ に保存される

---

### T-08: リトライ動作

**目的**: 5xx エラー時にリトライが実行されることを確認

**手順**:

1. API_Meter が 5xx を返す状況を作成（または一時的にネットワークを切断）

2. 送信を実行
   ```bash
   npm run cli -- --mode per_model --date 2025-12-06
   ```

3. ログを確認
   ```
   期待するログ:
   - "Retry attempt 1/3"
   - "Retry attempt 2/3"
   - "Retry attempt 3/3"
   - "Max retries exceeded, saving to spool"
   ```

**合格基準**:
- [ ] 指定回数のリトライが実行される
- [ ] リトライ失敗後にスプール保存される

---

### T-09: 送信失敗時のスプール保存

**目的**: 送信失敗時にスプールファイルが正しく保存されることを確認

**手順**:

1. 送信失敗を発生させる（T-06 または T-08 を利用）

2. スプールディレクトリを確認
   ```bash
   ls -la data/spool/
   ```

3. スプールファイルの内容を確認
   ```bash
   cat data/spool/*.json | jq .
   ```

**合格基準**:
- [ ] data/spool/ にファイルが保存される
- [ ] ファイル内容が ApiMeterRequest 形式である
- [ ] version フィールドが "2.0.0" である

---

### T-10: スプールファイルの再送

**目的**: スプールファイルが次回実行時に再送されることを確認

**手順**:

1. スプールファイルが存在することを確認
   ```bash
   ls data/spool/
   ```

2. 正しい認証情報で再実行
   ```bash
   npm run cli -- --mode per_model --date 2025-12-06
   ```

3. ログを確認
   ```
   期待するログ:
   - "Found X spool files to resend"
   - "Resending spool file: xxx.json"
   - "Spool file sent successfully"
   ```

4. スプールファイルが削除されたことを確認
   ```bash
   ls data/spool/
   ```

**合格基準**:
- [ ] スプールファイルが再送される
- [ ] 成功後にスプールファイルが削除される

---

### T-11: 冪等性（同一データの再送）

**目的**: 同じデータを複数回送信しても重複が発生しないことを確認

**手順**:

1. 同じ日付のデータを2回送信
   ```bash
   npm run cli -- --mode per_model --date 2025-12-06
   npm run cli -- --mode per_model --date 2025-12-06
   ```

2. ログを確認
   ```
   期待するログ（2回目）:
   - "200 OK"
   - "inserted: 0, updated: X"  # すべて更新扱い
   ```

3. API_Meter 管理画面で確認
   - レコード数が増えていないこと
   - updated_at が更新されていること

**合格基準**:
- [ ] 2回目の送信で inserted: 0 となる
- [ ] API_Meter 上のレコード数が増えない
- [ ] source_event_id が同一であること

---

### T-12: --dry-run オプション

**目的**: ドライランモードで実際の送信が行われないことを確認

**手順**:

1. ドライランで実行
   ```bash
   npm run cli -- --mode per_model --date 2025-12-06 --dry-run
   ```

2. ログを確認
   ```
   期待するログ:
   - "Dry run mode - skipping API_Meter send"
   - 集計結果が表示される
   ```

**合格基準**:
- [ ] API_Meter への送信が行われない
- [ ] 集計結果がログに出力される

---

### T-13: --date オプション

**目的**: 指定した日付のデータのみが処理されることを確認

**手順**:

1. 特定の日付を指定
   ```bash
   npm run cli -- --mode per_model --date 2025-12-01
   ```

2. ログを確認
   ```
   期待するログ:
   - "Filtering data for date: 2025-12-01"
   - usage_date が 2025-12-01 のレコードのみ
   ```

**合格基準**:
- [ ] 指定した日付のデータのみが処理される
- [ ] 他の日付のデータが含まれない

---

### T-14: per_user モードのスキップ

**目的**: API_Meter 非対応モードが正しくスキップされることを確認

**手順**:

1. per_user モードで実行
   ```bash
   npm run cli -- --mode per_user --date 2025-12-06
   ```

2. ログを確認
   ```
   期待するログ:
   - "per_user mode is not supported for API_Meter integration"
   - API_Meter への送信は行われない
   ```

**合格基準**:
- [ ] スキップメッセージが出力される
- [ ] エラーなく完了する

---

## 4. テスト結果サマリー

### 必須テスト項目

| No. | テスト項目 | 結果 | 実施日 | 確認者 |
|-----|----------|------|-------|-------|
| T-01 | per_model モードでの送信 | | | |
| T-02 | all モードでの送信 | | | |
| T-03 | プロバイダー名の正規化 | | | |
| T-04 | モデル名の標準化 | | | |
| T-05 | Bearer Token 認証 | | | |
| T-06 | 認証エラー（401） | | | |
| T-11 | 冪等性（同一データの再送） | | | |
| T-13 | --date オプション | | | |

### 推奨テスト項目

| No. | テスト項目 | 結果 | 実施日 | 確認者 |
|-----|----------|------|-------|-------|
| T-07 | バリデーションエラー（400） | | | |
| T-08 | リトライ動作 | | | |
| T-09 | 送信失敗時のスプール保存 | | | |
| T-10 | スプールファイルの再送 | | | |
| T-12 | --dry-run オプション | | | |
| T-14 | per_user モードのスキップ | | | |

---

## 5. トラブルシューティング

### よくある問題と対処法

#### 問題1: "Cannot find module" エラー

```bash
# 解決策
npm run build
```

#### 問題2: 401 Unauthorized エラー

```bash
# 確認事項
echo $API_METER_TOKEN
echo $API_METER_TENANT_ID

# トークンの再設定
export API_METER_TOKEN=correct-token
```

#### 問題3: ネットワークエラー

```bash
# 接続確認
curl -I $API_METER_URL

# プロキシ設定確認
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

#### 問題4: Dify データが取得できない

```bash
# 認証情報確認
echo $DIFY_CONSOLE_USER_EMAIL
echo $DIFY_WORKSPACE_ID

# 日付範囲確認
npm run cli -- --mode per_model --date 2025-12-06 --dry-run
```

---

## 6. 付録

### 6.1 ログレベルの設定

| レベル | 用途 |
|-------|------|
| error | エラーのみ |
| warn | 警告以上 |
| info | 通常運用（デフォルト） |
| debug | 詳細ログ（テスト時推奨） |

```bash
export LOG_LEVEL=debug
```

### 6.2 テストデータの確認

API_Meter に送信されるデータ形式:

**注意**: ADR 020 により、provider/model はマッピングなしで Dify のデータをそのまま転送します。

```json
{
  "tenant_id": "12345678-1234-1234-1234-123456789abc",
  "export_metadata": {
    "exporter_version": "1.1.0",
    "export_timestamp": "2025-12-06T10:00:00.000Z",
    "aggregation_period": "daily",
    "date_range": {
      "start": "2025-12-06T00:00:00.000Z",
      "end": "2025-12-06T00:00:00.000Z"
    }
  },
  "records": [
    {
      "usage_date": "2025-12-06",
      "provider": "aws-bedrock",
      "model": "claude-3-5-sonnet",
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

---

**ドキュメントバージョン**: 1.1.0
**作成日**: 2025-12-07
**更新日**: 2025-12-07
**対象バージョン**: dify-usage-exporter v1.1.0
**関連ADR**: ADR 020 - Exporter正規化層の責務削減とデータ忠実性の確保
