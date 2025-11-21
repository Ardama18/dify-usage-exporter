# タスク: カスタムエラークラス定義

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 004
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: task-003 → 成果物: src/types/env.ts（拡張済み）
- 提供: src/errors/dify-api-error.ts
- サイズ: 小規模（1ファイル + テスト）

## 実装内容

DifyApiErrorクラスとエラーコード定数を定義する。これにより、Dify API関連のエラーを構造化して処理し、適切なログ出力とリトライ判断が可能になる。

## 対象ファイル
- [ ] `src/errors/dify-api-error.ts` - カスタムエラークラス定義
- [ ] `test/unit/errors/dify-api-error.test.ts` - エラークラステスト

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] `test/unit/errors/dify-api-error.test.ts` を作成
  - DifyApiErrorのインスタンス生成テスト
  - エラーコードの設定確認テスト
  - statusCodeとdetailsのオプション引数テスト
  - エラー継承チェーンの確認テスト
- [ ] テスト実行して失敗を確認
  ```bash
  npm test -- test/unit/errors/dify-api-error.test.ts
  ```

### 2. Green Phase
- [ ] `src/errors/` ディレクトリを作成
- [ ] `src/errors/dify-api-error.ts` を作成
  ```typescript
  export class DifyApiError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode?: number,
      public readonly details?: Record<string, unknown>
    ) {
      super(message)
      this.name = 'DifyApiError'
    }
  }

  // エラーコード定義
  export const DIFY_API_ERROR_CODES = {
    NETWORK_ERROR: 'DIFY_NETWORK_ERROR',
    AUTHENTICATION_ERROR: 'DIFY_AUTH_ERROR',
    PERMISSION_ERROR: 'DIFY_PERMISSION_ERROR',
    VALIDATION_ERROR: 'DIFY_VALIDATION_ERROR',
    RATE_LIMIT_ERROR: 'DIFY_RATE_LIMIT_ERROR',
    SERVER_ERROR: 'DIFY_SERVER_ERROR',
    NOT_FOUND_ERROR: 'DIFY_NOT_FOUND_ERROR',
    BAD_REQUEST_ERROR: 'DIFY_BAD_REQUEST_ERROR',
  } as const

  export type DifyApiErrorCode = typeof DIFY_API_ERROR_CODES[keyof typeof DIFY_API_ERROR_CODES]
  ```

- [ ] テスト実行して通ることを確認
  ```bash
  npm test -- test/unit/errors/dify-api-error.test.ts
  ```

### 3. Refactor Phase
- [ ] エラーメッセージのヘルパー関数追加（必要に応じて）
- [ ] JSDocコメントの充実
- [ ] テストが引き続き通ることを確認

## 完了条件
- [ ] 単体テストが全てパス
  ```bash
  npm test -- test/unit/errors/dify-api-error.test.ts
  ```
- [ ] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [ ] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [ ] エラークラスがDesign Docの設計と一致
- [ ] エラーコードが定義されている
- [ ] Phase 1完了

## 関連する受入条件（AC）
- **AC-5-1**: もしネットワークエラー/5xx/429が発生した場合、システムは指数バックオフで最大3回リトライすること
- **AC-5-2**: もし400/401/403/404エラーが発生した場合、システムはリトライせずに処理を終了すること
- **AC-5-4**: システムはすべてのエラーを構造化ログ（JSON形式）で記録すること

## 依存タスク
- task-003: 環境変数スキーマ拡張

## 注意事項
- 影響範囲: DifyApiClient（Task 006）でこのエラークラスを使用
- 制約: エラーコードは一意であること
- WatermarkFileErrorはTask 005（WatermarkManager）で定義
