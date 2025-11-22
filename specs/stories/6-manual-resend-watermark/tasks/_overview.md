# 全体設計書: 手動再送とウォーターマーク操作CLI

生成日時: 2025-11-22
対象計画書: specs/stories/6-manual-resend-watermark/plan.md

## プロジェクトの全体像

### 目的とゴール
- `data/failed/`ディレクトリ内の失敗ファイルの手動再送機能を提供
- ウォーターマーク（last_fetched_date）の表示・リセット機能を提供
- CLIツールとして実装し、運用時の柔軟性を確保

### 背景とコンテキスト
- 自動リトライで10回失敗したファイルが`data/failed/`に移動される
- 運用者が手動で再送を試みる手段が必要
- ウォーターマークを過去に戻して再取得する機能が必要

## タスク分割の設計

### 分割方針
- **垂直スライス**を採用
- 各コマンド（list, resend, watermark）が独立して動作可能
- 1コマンド完成ごとに利用可能な状態を目指す
- TDD（Red-Green-Refactor）サイクルを各タスクで実践

### タスク間の関連マップ

```
Phase 1: SpoolManager拡張 + listコマンド
  task-001: SpoolManager拡張（listFailedFiles/deleteFailedFile/getFailedFile）
    → 成果物: src/sender/spool-manager.ts の拡張メソッド
  task-002: CLI基盤構築
    → 成果物: src/cli/bootstrap.ts, src/cli/index.ts, src/cli/types.ts
  task-003: listコマンド実装（task-001, task-002に依存）
    → 成果物: src/cli/commands/list.ts, 統合テスト
  task-004: CLI共通機能（task-002に依存）
    → 成果物: --help, --version, エラーハンドリング
  task-005: Phase 1完了確認

Phase 2: resendコマンド
  task-006: ExternalApiSender拡張（task-003に依存）
    → 成果物: src/sender/external-api-sender.ts のresendFailedFileメソッド
  task-007: resendコマンド実装（task-006に依存）
    → 成果物: src/cli/commands/resend.ts, 統合テスト
  task-008: Phase 2完了確認

Phase 3: watermarkコマンド
  task-009: promptユーティリティ実装（task-002に依存）
    → 成果物: src/cli/utils/prompt.ts
  task-010: watermarkコマンド実装（task-009に依存）
    → 成果物: src/cli/commands/watermark.ts, 統合テスト
  task-011: Phase 3完了確認

Phase 4: 全体統合 + E2E確認
  task-012: npm scripts追加（task-007, task-010に依存）
    → 成果物: package.json更新
  task-013: E2Eテスト実行
    → 成果物: 全E2Eテストパス
  task-014: 品質保証
    → 成果物: 全テスト・lint・型チェックパス
  task-015: Phase 4完了確認
```

### 共通化ポイント
- **CLI bootstrap**: 全コマンドで共有する依存関係構築（task-002）
- **エラーハンドリング**: handleError関数（task-004）
- **SpoolManager拡張**: listコマンドとresendコマンドで共有（task-001）

## 実装時の注意事項

### 全体を通じて守るべき原則

1. **TDD（Red-Green-Refactor）**: 失敗するテストを先に書く
2. **既存機能への影響禁止**: 既存のsend(), resendSpooled()の動作を変更しない
3. **責務の明確な分離**: resendFailedFile()はスプール保存を含まない

### リスクと対策

| リスク | 対策 | 検知方法 |
|--------|------|----------|
| Commander.js APIの不整合 | ADR 012を参照、公式ドキュメント確認 | Phase 1基盤構築時 |
| resendFailedFileとsend()の責務混同 | Design Doc記載の「send()との違い」を厳守 | 統合テスト |
| readline/promisesの非同期処理エラー | 適切なPromise処理とエラーハンドリング | 統合テスト |

### 影響範囲の管理

**変更が許可される範囲**:
- src/cli/（新規作成）
- src/sender/spool-manager.ts（メソッド追加）
- src/sender/external-api-sender.ts（メソッド追加）
- package.json（npm scripts追加、commander依存追加）

**変更禁止エリア**:
- 既存のsrc/index.ts（自動実行ロジック）
- 既存のExternalApiSender.send()、resendSpooled()の動作
- 既存のWatermarkManagerの動作
- 既存のテスト

## テストケース要件

### 統合テスト（108件）
- list-command.int.test.ts: 16件
- resend-command.int.test.ts: 43件
- watermark-command.int.test.ts: 32件
- common.int.test.ts: 17件

### E2Eテスト（36件）
- cli-commands.e2e.test.ts: 36件

## 受入条件サマリー

- resendコマンド: AC-RESEND-1〜6（6件）
- watermarkコマンド: AC-WM-1〜6（6件）
- listコマンド: AC-LIST-1〜4（4件）
- 共通: AC-COMMON-1〜3（3件）
- **合計: 19件のAC**
