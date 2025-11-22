---
story_id: "5"
title: monitoring-logging-healthcheck
feature: healthcheck
epic_id: "1"
type: task
task_number: "001"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: 環境変数スキーマ拡張

メタ情報:
- 依存: なし
- サイズ: 小規模（1ファイル）

## 実装内容
ヘルスチェックサーバー用の環境変数（HEALTHCHECK_PORT, HEALTHCHECK_ENABLED）をスキーマに追加する。

## 対象ファイル
- [x] src/types/env.ts
- [x] src/types/__tests__/env.test.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] src/types/__tests__/env.test.ts にヘルスチェック関連テストを追加
  - HEALTHCHECK_PORT のデフォルト値テスト（8080）
  - HEALTHCHECK_ENABLED のデフォルト値テスト（true）
  - HEALTHCHECK_PORT のカスタム値テスト
  - HEALTHCHECK_ENABLED=false のテスト
  - 無効な値（非数値ポート）のエラーテスト
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- src/types/__tests__/env.test.ts
  ```

### 2. Green Phase
- [x] src/types/env.ts の EnvSchema に追加:
  ```typescript
  HEALTHCHECK_PORT: z.coerce.number().default(8080),
  HEALTHCHECK_ENABLED: z.coerce.boolean().default(true),
  ```
- [x] Env 型が自動的に拡張されることを確認
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- src/types/__tests__/env.test.ts
  ```

### 3. Refactor Phase
- [x] コード整理（インポート順序、コメント追加など）
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
  npm run test:unit -- src/types/__tests__/env.test.ts
  ```

## 注意事項
- 影響範囲: 環境変数パース時にデフォルト値が適用される
- 制約: 既存の環境変数スキーマとの整合性を維持
- z.coerce を使用して文字列から適切な型への変換を行う
