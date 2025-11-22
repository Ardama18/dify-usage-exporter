---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "006"
phase: 2
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: ExternalApiSender拡張

メタ情報:
- 依存:
  - task-003: listコマンド実装（Phase 1完了）
- 提供: src/sender/external-api-sender.ts のresendFailedFileメソッド
- サイズ: 小規模（1ファイル + テスト）

## 実装内容

ExternalApiSenderクラスにCLI手動再送用のresendFailedFile()メソッドを追加する。
- ExternalApiRecord[]を受け取り、外部APIへ送信
- スプール保存ロジックを含まない（send()との明確な分離）
- 200/201/409レスポンスを成功扱い

**重要**: send()との違い
- send(): 新規データ送信用、失敗時は自動でスプール保存
- resendFailedFile(): 手動再送用、スプール保存なし、成功/失敗のみを返す

## 対象ファイル
- [x] src/sender/external-api-sender.ts
- [x] src/sender/__tests__/external-api-sender.test.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] Design DocのresendFailedFile仕様を確認
- [x] 既存ExternalApiSenderの構造を確認（send(), resendSpooled()）
- [x] resendFailedFile()のテストを作成
  - 送信成功パターン（200, 201）
  - 重複検出パターン（409）→成功扱い
  - 送信失敗パターン（500, ネットワークエラー）
  - send()との違い検証（スプール保存を含まない）
- [x] テスト実行して失敗を確認

### 2. Green Phase
- [x] resendFailedFile()の実装
  ```typescript
  /**
   * CLI手動再送用メソッド
   *
   * data/failed/内のファイルを外部APIへ送信する。
   * 自動リトライ後のスプール保存ロジックを含まない純粋な送信処理。
   */
  async resendFailedFile(records: ExternalApiRecord[]): Promise<void> {
    const batchKey = this.calculateBatchKey(records)

    const response = await this.httpClient.post('/usage', {
      batchIdempotencyKey: batchKey,
      records,
    })

    if (response.status === 200 || response.status === 201) {
      this.logger.info('CLI resend success', { recordCount: records.length })
      return
    }

    if (response.status === 409) {
      this.logger.warn('CLI resend: duplicate detected', { batchKey })
      return
    }

    // その他のエラーは例外としてスロー
    throw new Error(`Resend failed with status ${response.status}`)
  }
  ```
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] エラーハンドリングの改善
- [x] ログメッセージの統一
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] 既存のsend(), resendSpooled()のテストが引き続きパス
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 単体テスト実行）
  ```bash
  npm test -- --run src/sender/__tests__/external-api-sender.test.ts
  ```

## 注意事項
- 影響範囲: ExternalApiSenderクラスのみ
- 制約:
  - 既存のsend(), resendSpooled()の動作を変更しない
  - スプール保存ロジックを含めない
- 参考: 既存のsendToExternalApi()の実装パターン

## ACトレーサビリティ
- AC-RESEND-2: --fileオプションで指定ファイル再送
- AC-RESEND-3: --allオプションで全ファイル再送
- AC-RESEND-4: 再送成功時にファイル削除
- AC-RESEND-5: 再送失敗時にエラー表示・ファイル保持
