---
story_id: "1"
title: foundation-and-scheduler
feature: foundation
task_number: "003"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: 環境変数管理実装と統合テスト作成

メタ情報:
- 依存: task-002 → 成果物: src/types/env.ts
- 提供: src/config/env-config.ts（loadConfig関数）
- サイズ: 中規模（実装1ファイル + テスト1ファイル）

## 実装内容

dotenvとZodを使用した環境変数管理モジュールを実装する。起動時に環境変数を読み込み、Zodスキーマで検証し、型安全な設定オブジェクトを返す。検証失敗時はエラーメッセージを出力してexit(1)で終了。

## 対象ファイル

- [ ] src/config/env-config.ts
- [ ] test/integration/foundation-and-scheduler.int.test.ts（AC-ENV部分）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [ ] ディレクトリ作成
  ```bash
  mkdir -p src/config test/integration
  ```
- [ ] 統合テストファイルの作成（AC-ENV-1〜5）
  - AC-ENV-1: 起動時の環境変数読み込み（2件）
  - AC-ENV-2: 必須環境変数未設定時のエラー処理（5件）
  - AC-ENV-3: 不正値時のZodエラー処理（8件）
  - AC-ENV-4: オプション環境変数のデフォルト値（5件）
  - AC-ENV-5: loadConfig()経由の設定取得（2件）
- [ ] テスト実行して失敗を確認
  ```bash
  npm run test:integration
  ```

### 2. Green Phase

- [ ] loadConfig()関数の実装（Design Doc準拠）
  ```typescript
  // src/config/env-config.ts
  import dotenv from 'dotenv'
  import { envSchema, type EnvConfig } from '../types/env.js'

  export function loadConfig(): EnvConfig {
    dotenv.config()

    const result = envSchema.safeParse(process.env)

    if (!result.success) {
      console.error('環境変数の検証に失敗しました:')
      console.error(result.error.format())
      process.exit(1)
    }

    return result.data
  }
  ```
- [ ] テスト実行して通ることを確認

### 3. Refactor Phase

- [ ] コード改善（テストが通る状態を維持）
- [ ] `npm run check` でlint/formatエラーなし

## テストケース詳細

### AC-ENV-1: 起動時の環境変数読み込み（2件）
- 正常な環境変数セットでloadConfig()が成功
- 返却値がEnvConfig型に準拠

### AC-ENV-2: 必須環境変数未設定時のエラー処理（5件）
- DIFY_API_URL未設定でexit(1)
- DIFY_API_TOKEN未設定でexit(1)
- EXTERNAL_API_URL未設定でexit(1)
- EXTERNAL_API_TOKEN未設定でexit(1)
- 複数の必須環境変数未設定でエラーメッセージ出力

### AC-ENV-3: 不正値時のZodエラー処理（8件）
- DIFY_API_URLが不正なURL形式
- EXTERNAL_API_URLが不正なURL形式
- LOG_LEVELが無効な値
- GRACEFUL_SHUTDOWN_TIMEOUTが数値でない
- GRACEFUL_SHUTDOWN_TIMEOUTが1未満
- GRACEFUL_SHUTDOWN_TIMEOUTが300超過
- MAX_RETRYが1未満
- MAX_RETRYが10超過

### AC-ENV-4: オプション環境変数のデフォルト値（5件）
- CRON_SCHEDULEデフォルト: '0 0 * * *'
- LOG_LEVELデフォルト: 'info'
- GRACEFUL_SHUTDOWN_TIMEOUTデフォルト: 30
- MAX_RETRYデフォルト: 3
- NODE_ENVデフォルト: 'production'

### AC-ENV-5: loadConfig()経由の設定取得（2件）
- process.envを直接参照せずloadConfig()経由で取得
- 複数回呼び出しても同一設定を返却

## 完了条件

- [ ] 追加したテストが全てパス（22件）
- [ ] TypeScript strict mode: エラー0件
- [ ] Biome lint: エラー0件
- [ ] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm run test:integration -- foundation-and-scheduler.int.test.ts
  ```
- [ ] 必須環境変数検証が1秒以内に完了
- [ ] トレーサビリティ: AC-ENV-1（2件）、AC-ENV-2（5件）、AC-ENV-3（8件）、AC-ENV-4（5件）、AC-ENV-5（2件）

## 注意事項

- **影響範囲**: 全モジュールが本関数を使用
- **制約**: Design Docのインターフェースに完全準拠
- **エラー処理**: 検証失敗時はconsole.errorでエラー出力後、exit(1)で終了
- **テスト考慮**: process.exit()をモック化してテスト可能にする
