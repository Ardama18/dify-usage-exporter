---
story_id: "5"
title: monitoring-logging-healthcheck
feature: healthcheck
epic_id: "1"
type: task
task_number: "002"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: HealthCheckServer実装

メタ情報:
- 依存: task-001-env-schema（環境変数スキーマ）
- サイズ: 中規模（2ファイル）

## 実装内容
HTTPサーバーによるヘルスチェック機能を実装する。GET /health エンドポイントでJSON形式のヘルス情報を返す。

## 対象ファイル
- [x] src/healthcheck/healthcheck-server.ts（新規作成）
- [x] src/healthcheck/__tests__/healthcheck-server.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] src/healthcheck/__tests__/healthcheck-server.test.ts 作成
- [x] 以下のテストケースを作成:
  - createHealthCheckServer がサーバーインスタンスを返す
  - start() でサーバーが起動する
  - stop() でサーバーが停止する
  - GET /health が200ステータスを返す
  - レスポンスに status, uptime, timestamp が含まれる
  - GET /invalid が404を返す
  - POST /health が404を返す
  - EADDRINUSE エラー時の処理
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- src/healthcheck/__tests__/healthcheck-server.test.ts
  ```

### 2. Green Phase
- [x] src/healthcheck/healthcheck-server.ts 作成
- [x] 型定義:
  ```typescript
  interface HealthCheckServerOptions {
    port: number;
    logger: ILogger;
  }

  interface HealthCheckResponse {
    status: 'ok';
    uptime: number;
    timestamp: string;
  }

  interface HealthCheckServer {
    start(): Promise<void>;
    stop(): Promise<void>;
  }
  ```
- [x] createHealthCheckServer ファクトリ関数実装
- [x] start() メソッド: server.listen() を Promise でラップ
- [x] stop() メソッド: server.close() を Promise でラップ
- [x] リクエストハンドラ:
  - パスとメソッドの検証
  - /health 以外は 404 返却
  - GET 以外は 404 返却
  - レスポンスボディ生成
- [x] EADDRINUSE エラーハンドリング（警告ログ出力、起動継続）
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- src/healthcheck/__tests__/healthcheck-server.test.ts
  ```

### 3. Refactor Phase
- [x] エラーハンドリングの整理
- [x] ログメッセージの統一
- [x] テストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L1: 単体テスト実行）
  ```bash
  npm run test:unit -- src/healthcheck/__tests__/healthcheck-server.test.ts
  ```

## 注意事項
- 影響範囲: 新規ディレクトリ作成、既存コードへの影響なし
- 制約: Node.js の http モジュールを使用（外部依存追加なし）
- AC-HC-1, AC-HC-2, AC-ERR-1, AC-ERR-2, AC-ERR-3 対応
