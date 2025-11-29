# 手動テスト仕様書

dify-usage-exporter 全体の手動テスト仕様書です。自動テストでカバーしにくい実環境での動作確認を目的とします。

## 1. テスト環境準備

### 1.1 環境変数設定

```bash
# 必須環境変数
export DIFY_API_BASE_URL="https://api.dify.ai"
export DIFY_EMAIL="your-email@example.com"
export DIFY_PASSWORD="your-password"
export EXTERNAL_API_URL="https://your-external-api.com"
export EXTERNAL_API_TOKEN="your-external-api-token"

# オプション（デフォルト値あり）
export CRON_SCHEDULE="*/5 * * * *"           # 5分ごと
export DATA_DIR="./data"                      # データディレクトリ
export HEALTHCHECK_PORT="8080"                # ヘルスチェックポート
export HEALTHCHECK_ENABLED="true"             # ヘルスチェック有効
```

### 1.2 ディレクトリ構成確認

```bash
mkdir -p data/spool data/failed
```

### 1.3 ビルド

```bash
npm run build
```

---

## 2. 基本機能テスト

### 2.1 アプリケーション起動

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| BASIC-1 | 正常起動 | `npm start` | 起動ログが表示され、cronジョブがスケジュールされる |
| BASIC-2 | 環境変数不足 | `DIFY_EMAIL`または`DIFY_PASSWORD`を未設定で起動 | バリデーションエラーで終了 |
| BASIC-3 | Graceful Shutdown | 起動後 `Ctrl+C` | 「Graceful shutdown completed」が表示 |

### 2.2 データ取得・送信

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| FETCH-1 | Dify API取得 | cronトリガーを待つ | ログに取得レコード数が表示 |
| FETCH-2 | 外部API送信 | FETCH-1の後 | 送信成功ログが表示 |
| FETCH-3 | ウォーターマーク更新 | FETCH-2の後 | `data/watermark.json`が更新される |

---

## 3. Story 5: モニタリング・ロギング・ヘルスチェック

### 3.1 ヘルスチェックエンドポイント

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| HC-1 | 正常応答 | `curl http://localhost:8080/health` | `{"status":"ok","uptime":...,"timestamp":"..."}`<br>HTTPステータス: 200 |
| HC-2 | 存在しないパス | `curl http://localhost:8080/unknown` | HTTPステータス: 404 |
| HC-3 | ポート変更 | `HEALTHCHECK_PORT=9090`で起動後<br>`curl http://localhost:9090/health` | 正常応答 |
| HC-4 | 無効化 | `HEALTHCHECK_ENABLED=false`で起動 | ポートがリッスンされない |

### 3.2 メトリクス出力

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| METRICS-1 | JSON Lines形式 | cronジョブ実行後のログ確認 | 以下の形式でメトリクスが出力される |

**期待されるメトリクス出力例:**
```json
{
  "type": "execution_metrics",
  "executionId": "exec-1234567890-abcd",
  "timestamp": "2025-01-22T10:00:00.000Z",
  "duration": 1234,
  "records": {
    "fetched": 100,
    "transformed": 100,
    "sendSuccess": 95,
    "sendFailed": 5,
    "spoolSaved": 5,
    "spoolResendSuccess": 0,
    "failedMoved": 0
  },
  "recordsPerSecond": 81.0
}
```

---

## 4. Story 6: 手動再送とウォーターマーク操作CLI

### 4.1 listコマンド

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| LIST-1 | 空ディレクトリ | `data/failed/`が空の状態で<br>`npm run cli -- list` | 「No failed files found.」 |
| LIST-2 | ファイル一覧 | テストファイルを配置後<br>`npm run cli -- list` | 表形式で一覧表示（Filename, Records, First Attempt, Last Error） |
| LIST-3 | JSON出力 | `npm run cli -- list --json` | JSON配列形式で出力 |
| LIST-4 | 合計表示 | LIST-2の後 | 「Total: X files, Y records」が表示 |

**テスト用ファイル作成:**
```bash
# data/failed/test-file.json を作成
cat > data/failed/test-file.json << 'EOF'
{
  "records": [
    {"app_id": "test", "conversation_id": "conv1", "message_id": "msg1", "created_at": "2025-01-01T00:00:00Z"}
  ],
  "metadata": {
    "firstAttempt": "2025-01-20T10:00:00.000Z",
    "lastError": "Connection timeout"
  }
}
EOF
```

### 4.2 resendコマンド

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| RESEND-1 | 引数なし | `npm run cli -- resend` | ファイル一覧が表示される |
| RESEND-2 | 指定ファイル再送 | `npm run cli -- resend --file test-file.json` | 成功時: ファイル削除、サマリー表示<br>失敗時: ファイル保持、エラー表示 |
| RESEND-3 | 全ファイル再送 | `npm run cli -- resend --all` | 全ファイル処理後、サマリー表示 |
| RESEND-4 | 存在しないファイル | `npm run cli -- resend --file notfound.json` | エラー表示、exit code 1 |

**期待されるサマリー出力:**
```
Resend Summary:
  Success: 1 files (100 records)
  Failed: 0 files (0 records)
```

### 4.3 watermarkコマンド

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| WM-1 | show（設定あり） | `npm run cli -- watermark show` | last_fetched_date と last_updated_at が表示 |
| WM-2 | show（未設定） | `data/watermark.json`を削除後<br>`npm run cli -- watermark show` | 「Watermark not set」 |
| WM-3 | reset（確認プロンプト） | `npm run cli -- watermark reset 2025-01-01T00:00:00Z` | 確認プロンプト表示、「y」で実行 |
| WM-4 | reset（キャンセル） | WM-3で「n」を入力 | 「Cancelled」表示、ウォーターマーク変更なし |
| WM-5 | reset（--yes） | `npm run cli -- watermark reset 2025-01-01T00:00:00Z --yes` | 確認なしで即実行 |
| WM-6 | reset（不正日時） | `npm run cli -- watermark reset invalid-date` | エラー表示、exit code 1 |

**期待されるshow出力:**
```
Current Watermark:
  Last Fetched Date: 2025-01-22T10:00:00.000Z
  Last Updated At:   2025-01-22T10:00:00.000Z
```

### 4.4 共通機能

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| COMMON-1 | ヘルプ表示 | `npm run cli -- --help` | 全コマンドのヘルプ表示 |
| COMMON-2 | バージョン表示 | `npm run cli -- --version` | バージョン番号表示 |
| COMMON-3 | 未知コマンド | `npm run cli -- unknown` | エラー表示、exit code 1 |

---

## 5. 統合シナリオテスト

### 5.1 完全なジョブサイクル

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| INT-1 | 正常サイクル | 1. アプリ起動<br>2. cronジョブ実行待ち<br>3. ヘルスチェック確認<br>4. メトリクス確認 | 全ステップ正常完了 |
| INT-2 | 失敗→再送サイクル | 1. 外部API停止状態でジョブ実行<br>2. `data/failed/`にファイル作成確認<br>3. 外部API復旧<br>4. `npm run cli -- resend --all` | 再送成功、ファイル削除 |

### 5.2 異常系シナリオ

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| ERR-1 | Dify API接続失敗 | 無効なDIFY_EMAILまたはDIFY_PASSWORDで起動 | エラーログ出力、次回リトライ |
| ERR-2 | 外部API接続失敗 | 無効なEXTERNAL_API_URLで起動 | データがspoolに保存 |
| ERR-3 | ディスク容量不足 | data/ディレクトリを読み取り専用に | エラーログ出力 |

---

## 6. パフォーマンス確認

| ID | テスト項目 | 手順 | 期待結果 |
|----|-----------|------|----------|
| PERF-1 | 大量データ処理 | 1000件以上のレコードを取得 | メトリクスのrecordsPerSecondが妥当な値 |
| PERF-2 | ヘルスチェック応答時間 | `time curl http://localhost:8080/health` | 100ms以下 |
| PERF-3 | CLI起動時間 | `time npm run cli -- --help` | 3秒以下 |

---

## 7. テスト結果記録

### テスト実施記録

| 実施日 | 実施者 | 環境 | 結果 | 備考 |
|--------|--------|------|------|------|
| | | | | |

### 不具合記録

| ID | 発見日 | テストID | 現象 | ステータス |
|----|--------|----------|------|------------|
| | | | | |

---

## 8. 注意事項

1. **本番環境での実行禁止**: このテストは開発/ステージング環境でのみ実施してください
2. **データバックアップ**: ウォーターマークリセット前に`data/watermark.json`をバックアップ
3. **API制限**: Dify APIのレート制限に注意
4. **ログ確認**: 各テスト後にログを確認し、警告やエラーがないか確認

---

## 9. トラブルシューティング

### よくある問題

| 症状 | 原因 | 対処 |
|------|------|------|
| CLI起動時にエラー | 環境変数未設定 | 必須環境変数を設定 |
| ヘルスチェック接続拒否 | ポート競合 | `HEALTHCHECK_PORT`を変更 |
| resend失敗 | 外部API接続エラー | EXTERNAL_API_URLとトークンを確認 |
| watermark resetエラー | 日時形式不正 | ISO 8601形式（例: 2025-01-01T00:00:00Z）を使用 |
