---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "001"
phase: 1
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: SpoolManager拡張

メタ情報:
- 依存: なし
- 提供: src/sender/spool-manager.ts の拡張メソッド（listFailedFiles, deleteFailedFile, getFailedFile）
- サイズ: 小規模（1ファイル + テスト）

## 実装内容

SpoolManagerクラスに`data/failed/`ディレクトリ操作用のメソッドを追加する。
- listFailedFiles(): 失敗ファイル一覧を取得（firstAttempt昇順でソート）
- deleteFailedFile(): 指定ファイルを削除
- getFailedFile(): 指定ファイル名からSpoolFileを取得

## 対象ファイル
- [x] src/sender/spool-manager.ts
- [x] src/sender/__tests__/spool-manager.test.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 既存SpoolManagerの構造を確認
- [x] listFailedFiles()のテストを作成
  - 空ディレクトリで空配列を返す
  - 複数ファイルをfirstAttempt昇順でソート
  - 無効なJSONファイルをスキップ
- [x] deleteFailedFile()のテストを作成
  - 正常削除
  - 存在しないファイルでエラー
- [x] getFailedFile()のテストを作成
  - 正常取得
  - 存在しないファイルでnull
- [x] テスト実行して失敗を確認

### 2. Green Phase
- [x] listFailedFiles()の実装
  ```typescript
  async listFailedFiles(): Promise<SpoolFile[]> {
    const failedDir = path.join(this.config.dataDir, 'failed')
    // ディレクトリ存在確認
    // ファイル一覧取得
    // JSON読み込み
    // firstAttempt昇順ソート
  }
  ```
- [x] deleteFailedFile()の実装
  ```typescript
  async deleteFailedFile(filename: string): Promise<void> {
    const failedDir = path.join(this.config.dataDir, 'failed')
    const filePath = path.join(failedDir, filename)
    // ファイル存在確認
    // 削除実行
  }
  ```
- [x] getFailedFile()の実装
  ```typescript
  async getFailedFile(filename: string): Promise<SpoolFile | null> {
    const failedDir = path.join(this.config.dataDir, 'failed')
    const filePath = path.join(failedDir, filename)
    // ファイル存在確認
    // JSON読み込み
  }
  ```
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] 既存のlistSpoolFiles()とのコード重複を確認
- [x] 共通処理の抽出検討（必要に応じて）
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] 既存のlistSpoolFiles(), deleteSpoolFile()のテストが引き続きパス
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 単体テスト実行）
  ```bash
  npm test -- --run src/sender/__tests__/spool-manager.test.ts
  ```

## 注意事項
- 影響範囲: SpoolManagerクラスのみ（他への波及なし）
- 制約: 既存のlistSpoolFiles(), deleteSpoolFile()の動作を変更しない
- 参考: 既存のlistSpoolFiles()の実装パターンを踏襲

## ACトレーサビリティ
- AC-LIST-1, AC-LIST-2, AC-LIST-3, AC-LIST-4
