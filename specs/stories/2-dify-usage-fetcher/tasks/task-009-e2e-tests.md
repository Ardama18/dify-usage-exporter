# タスク: E2Eテスト実行

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 009
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: task-008 → 成果物: 統合テスト完全版
- 提供: test/e2e/dify-usage-fetcher.e2e.test.ts
- サイズ: 中規模（E2Eテストファイル）

## 実装内容

E2Eテスト（44件）を実装し、実際の動作フローを検証する。初回実行、差分取得、エラー復旧、Docker環境での動作を確認する。

## 対象ファイル
- [x] `test/e2e/dify-usage-fetcher.e2e.test.ts` - E2Eテスト

## 実装手順

### 1. E2Eテスト環境準備
- [x] モックサーバーの設定確認
- [x] テスト用環境変数の設定
  ```bash
  export DIFY_API_BASE_URL="http://localhost:3001/mock"
  export DIFY_API_TOKEN="test-token"
  export WATERMARK_FILE_PATH="tmp/test-watermark.json"
  ```
- [x] テストデータの準備

### 2. E2Eテスト実装
- [x] `test/e2e/dify-usage-fetcher.e2e.test.ts` を作成
  ```typescript
  describe('DifyUsageFetcher E2Eテスト', () => {
    describe('初回実行シナリオ', () => {
      // 5件
      // - ウォーターマーク不存在時の挙動
      // - 過去30日分のデータ取得
      // - ウォーターマーク作成
      // - ログ出力確認
      // - 正常終了
    })

    describe('差分取得シナリオ', () => {
      // 6件
      // - ウォーターマーク読み込み
      // - 差分期間の計算
      // - 差分データのみ取得
      // - ウォーターマーク更新
      // - 重複取得なし
      // - 正常終了
    })

    describe('ページング処理シナリオ', () => {
      // 5件
      // - 複数ページ取得
      // - has_more制御
      // - ページ間ディレイ
      // - 進捗ログ
      // - 全ページ取得完了
    })

    describe('エラー復旧シナリオ', () => {
      // 8件
      // - 5xxエラーからの復旧（リトライ）
      // - 429エラーからの復旧（Retry-After）
      // - ネットワークエラーからの復旧
      // - 401エラー時の終了
      // - バリデーションエラー時のスキップ
      // - ウォーターマーク破損時の復元
      // - 部分取得後のウォーターマーク更新
      // - エラーログ出力
    })

    describe('ログ出力シナリオ', () => {
      // 6件
      // - 開始ログ
      // - 進捗ログ
      // - 完了ログ
      // - エラーログ
      // - リトライログ
      // - トークン非出力確認
    })

    describe('環境変数設定シナリオ', () => {
      // 5件
      // - カスタムページサイズ
      // - カスタムタイムアウト
      // - カスタムリトライ設定
      // - カスタムウォーターマークパス
      // - カスタム初回取得日数
    })

    describe('全体フローシナリオ', () => {
      // 5件
      // - 完全な取得フロー（開始→取得→完了）
      // - 複数回実行（初回→差分→差分）
      // - 大量データ取得
      // - 長時間実行（タイムアウト確認）
      // - 正常終了ステータス
    })

    describe('Docker環境シナリオ', () => {
      // 4件
      // - コンテナ起動
      // - 環境変数読み込み
      // - ボリュームマウント（ウォーターマーク永続化）
      // - 正常終了
    })
  })
  ```

### 3. テスト実行・検証
- [x] E2Eテスト実行
  ```bash
  npm test -- test/e2e/dify-usage-fetcher.e2e.test.ts
  ```
- [x] テスト件数が44件であることを確認
- [x] 全テストがパスすることを確認

### 4. Docker環境テスト
- [x] Dockerイメージビルド
  ```bash
  docker build -t dify-usage-exporter:test .
  ```
- [x] Docker環境でのテスト実行
  ```bash
  docker run --rm dify-usage-exporter:test npm test -- test/e2e/
  ```

## 完了条件
- [x] 全44件のE2Eテストがパス
  ```bash
  npm test -- test/e2e/dify-usage-fetcher.e2e.test.ts
  ```
- [x] Docker環境での動作確認完了
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件

## テスト件数内訳

| シナリオ | テスト件数 |
|---------|-----------|
| 初回実行 | 5件 |
| 差分取得 | 6件 |
| ページング処理 | 5件 |
| エラー復旧 | 8件 |
| ログ出力 | 6件 |
| 環境変数設定 | 5件 |
| 全体フロー | 5件 |
| Docker環境 | 4件 |
| **合計** | **44件** |

## 関連する受入条件（AC）
- 全AC（AC-1-1 〜 AC-NF-4）をE2E観点で検証

## 依存タスク
- task-008: 統合テスト実装・実行

## 注意事項
- 影響範囲: 最終的な動作保証
- 制約: E2Eテストは実際のファイルシステム・プロセスを使用
- テスト実行時間: 全体で5分以内を目標
- Docker環境テストは実際のコンテナを使用（モックなし）
- クリーンアップ: テスト後に一時ファイルを確実に削除
